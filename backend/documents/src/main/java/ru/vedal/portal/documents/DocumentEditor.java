package ru.vedal.portal.documents;

import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import ru.vedal.portal.audit.AuditLog;
import ru.vedal.portal.common.ConflictException;
import ru.vedal.portal.common.DomainEvents;
import ru.vedal.portal.common.NotFoundException;
import ru.vedal.portal.common.Versions;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// Правка документов. Правила публикации живут здесь, а не в контроллере:
// контроллер — это транспорт, и правило, записанное в нём, действует ровно
// до появления второго транспорта. Здесь оно действует для любого
// вызывающего — двери правки, будущего импорта, теста.
@Service
public class DocumentEditor implements DocumentAdmin {

    private static final String DOCUMENT_EVENT = "vedal.documents.v1";

    private final DocumentRepository documents;
    private final FileStorage storage;
    private final DomainEvents events;
    private final AuditLog audit;
    private final TransactionTemplate transactions;

    public DocumentEditor(DocumentRepository documents, FileStorage storage,
                          DomainEvents events, AuditLog audit,
                          PlatformTransactionManager transactionManager) {
        this.documents = documents;
        this.storage = storage;
        this.events = events;
        this.audit = audit;
        // Шаблон, а не @Transactional на методе: границу транзакции здесь надо
        // ставить руками вокруг двух коротких участков, а не вокруг всего
        // метода — между ними идёт сетевая отправка файла.
        this.transactions = new TransactionTemplate(transactionManager);
    }

    @Override
    @Transactional(readOnly = true)
    public List<DocumentRow> allDocuments() {
        return documents.findAllByOrderByDocGroupAscTitleAsc().stream().map(DocumentEditor::row).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public DocumentRow document(UUID id) {
        return row(find(id));
    }

    @Override
    @Transactional
    public DocumentRow createDocument(DocumentForm form, String actor) {
        check(form);
        documents.findBySlug(form.slug()).ifPresent(d -> {
            throw new ConflictException("Документ с таким slug уже есть: " + form.slug());
        });

        var document = new Document();
        document.setId(UUID.randomUUID());
        document.setCreatedAt(Instant.now());
        document.setPublished(false);
        apply(document, form);
        documents.save(document);

        audit.record(actor, "document.create", "document", document.getSlug(),
                Map.of("sensitivity", document.getSensitivity()));
        return row(document);
    }

    @Override
    @Transactional
    public DocumentRow updateDocument(UUID id, DocumentForm form, String actor) {
        check(form);
        var document = find(id);
        Versions.check(form.version(), document.getVersion(), "Документ");

        if (document.isPublished() && !document.getSlug().equals(form.slug())) {
            throw new ConflictException(
                    "Опубликованный документ нельзя переименовать: ссылка на файл "
                            + "перестанет открываться. Снимите с публикации, потом переименуйте.");
        }
        if (!document.getSlug().equals(form.slug())
                && documents.findBySlug(form.slug()).isPresent()) {
            throw new ConflictException("Документ с таким slug уже есть: " + form.slug());
        }

        // Понижение секретности у опубликованного документа отдало бы наружу
        // то, что наружу не отдаётся. Ограничение document_public_only не даст
        // сохранить такую строку — объясняем заранее.
        if (document.isPublished() && !"public".equals(form.sensitivity())) {
            throw new ConflictException(
                    "Документ опубликован. Чтобы пометить его как " + form.sensitivity()
                            + ", сначала снимите его с публикации.");
        }

        apply(document, form);
        documents.saveAndFlush(document);

        audit.record(actor, "document.edit", "document", document.getSlug(),
                Map.of("sensitivity", document.getSensitivity()));
        return row(document);
    }

    // Метод НЕ транзакционный, и это принципиально.
    //
    // Отправка двадцати мегабайт в объектное хранилище — сетевая операция
    // на десятки секунд. Внутри транзакции она держала бы соединение из пула
    // всё это время: десяток параллельных загрузок исчерпывает пул, и посторонние
    // запросы начинают падать с «Connection is not available».
    //
    // Поэтому здесь три отдельных шага: короткое чтение, отправка без
    // транзакции, короткая запись. Транзакция открывается только на третий.
    @Override
    public DocumentRow uploadFile(UUID id, Upload upload, String actor) {
        if (upload.size() <= 0) {
            throw new ConflictException("Файл пустой");
        }

        var slug = transactions.execute(status -> find(id).getSlug());
        var key = slug + extension(upload.filename());

        try (var data = upload.data()) {
            // Предел размера проверяет само хранилище: он его свойство,
            // а не свойство этой двери.
            storage.put(FileStorage.Area.DOCUMENTS, key, data, upload.size(), upload.contentType());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }

        return transactions.execute(status -> {
            var document = find(id);

            // Замена файла у опубликованного документа меняет то, что скачивают
            // прямо сейчас. Публикацию не снимаем автоматически — это решение
            // редактора, — но след в журнале обязателен.
            document.setStorageKey(key);
            document.setFileSize(upload.size());
            document.setUpdatedAt(Instant.now());
            documents.save(document);

            audit.record(actor, "document.upload", "document", document.getSlug(),
                    Map.of("size", upload.size(), "published", document.isPublished()));
            return row(document);
        });
    }

    @Override
    @Transactional
    public DocumentRow setPublished(UUID id, boolean published, String actor) {
        var document = find(id);
        if (document.isPublished() == published) return row(document);

        if (published) {
            var refusal = publishBlockedBy(document);
            if (refusal != null) throw new ConflictException(refusal);
            document.setApprovedBy(actor);
        }

        document.setPublished(published);
        document.setUpdatedAt(Instant.now());
        documents.save(document);

        // Событие и строка коммитятся одним COMMIT. Персональных данных
        // в payload нет — только то, по чему потребитель поймёт, что делать.
        events.record("document", document.getSlug(), DOCUMENT_EVENT,
                Map.of("action", published ? "published" : "unpublished",
                        "slug", document.getSlug(),
                        "group", document.getDocGroup()));

        audit.record(actor, published ? "document.publish" : "document.unpublish",
                "document", document.getSlug(), Map.of("sensitivity", document.getSensitivity()));
        return row(document);
    }

    // Те же правила, что закрыты ограничениями схемы. Дублирование намеренное:
    // база не даст нарушить правило, но редактор должен увидеть причину
    // до нажатия, а не отказ с именем ограничения после.
    private static String publishBlockedBy(Document document) {
        if (!"public".equals(document.getSensitivity())) {
            return "Документ помечен как " + document.getSensitivity()
                    + ". Публично размещаются только public: сервисные инструкции, "
                    + "конструкторская и производственная документация на сайт не выкладываются.";
        }
        if (document.getStorageKey() == null) {
            return "Файл не загружен — публикация обещала бы скачивание, которого нет.";
        }
        if (!document.isListed()) {
            return "Документ не включён в публичный перечень.";
        }
        return null;
    }

    private static void check(DocumentForm form) {
        if (!GROUPS.contains(form.group())) {
            throw new ConflictException("Неизвестный раздел: " + form.group()
                    + ". Допустимые: " + String.join(", ", GROUPS));
        }
        if (!SENSITIVITIES.contains(form.sensitivity())) {
            throw new ConflictException("Неизвестный уровень секретности: " + form.sensitivity());
        }
        if (!ACCESS_KINDS.contains(form.access())) {
            throw new ConflictException("Неизвестный уровень доступа: " + form.access());
        }
    }

    private static void apply(Document document, DocumentForm form) {
        document.setSlug(form.slug());
        document.setTitle(form.title());
        document.setDocGroup(form.group());
        document.setSubject(form.subject());
        document.setProductSlug(blankToNull(form.productSlug()));
        document.setSensitivity(form.sensitivity());
        document.setAccess(form.access());
        document.setListed(form.listed());
        document.setRevision(blankToNull(form.revision()));
        document.setSourceOwner(blankToNull(form.sourceOwner()));
        document.setUpdatedAt(Instant.now());
    }

    private static DocumentRow row(Document d) {
        return new DocumentRow(d.getId(), d.getVersion(), d.getSlug(), d.getTitle(), d.getDocGroup(), d.getSubject(),
                d.getProductSlug(), d.getSensitivity(), d.getAccess(), d.isListed(), d.isPublished(),
                d.getStorageKey() != null, d.getFileSize(), d.getRevision(), d.getApprovedBy(),
                d.getUpdatedAt(), d.isPublished() ? null : publishBlockedBy(d));
    }

    private static String extension(String filename) {
        if (filename == null) return "";
        var dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot).toLowerCase();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private Document find(UUID id) {
        return documents.findById(id).orElseThrow(() -> new NotFoundException("Документ не найден"));
    }
}
