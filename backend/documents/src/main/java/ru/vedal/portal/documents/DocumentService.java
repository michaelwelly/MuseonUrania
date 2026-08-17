package ru.vedal.portal.documents;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.audit.AuditLog;
import ru.vedal.portal.common.NotFoundException;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class DocumentService implements DocumentQuery {

    private final DocumentRepository documents;
    private final FileStorage storage;
    private final AuditLog audit;

    public DocumentService(DocumentRepository documents, FileStorage storage, AuditLog audit) {
        this.documents = documents;
        this.storage = storage;
        this.audit = audit;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Card> listedDocuments() {
        // Перечень показывается вместе со статусом доступа, даже когда файла
        // ещё нет: страница «Документы» так и устроена — строка без файла ведёт
        // на запрос. Ссылку отдаём только у опубликованных.
        return documents.findByListedTrueOrderByDocGroupAscTitleAsc().stream()
                .map(d -> new Card(d.getSlug(), d.getTitle(), d.getDocGroup(), d.getSubject(),
                        d.getProductSlug(), d.getAccess(), d.isPublished(),
                        d.isPublished() ? "/api/public/v1/documents/" + d.getSlug() + "/file" : null))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Ref> ref(UUID id) {
        return documents.findById(id).map(DocumentService::ref);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Ref> refs(Collection<UUID> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return documents.findAllById(ids).stream().map(DocumentService::ref).toList();
    }

    private static Ref ref(Document d) {
        return new Ref(d.getId(), d.getSlug(), d.getTitle(), d.isPublished());
    }

    @Override
    @Transactional
    public Download download(String slug) {
        var document = documents.findBySlug(slug).orElse(null);

        // Неопубликованный документ для внешнего мира не существует: 404, а не
        // 403 — иначе по коду ответа видно, что такой документ есть.
        //
        // Попытку журналируем в отдельной транзакции: сразу за этим летит
        // исключение, и запись в общей транзакции откатилась бы вместе с ним.
        if (document == null || !document.isPublished() || document.getStorageKey() == null) {
            audit.recordIndependently("public", "document.access.denied", "document", slug, Map.of());
            throw new NotFoundException("Документ не найден");
        }

        FileStorage.Stored stored;
        try {
            stored = storage.open(FileStorage.Area.DOCUMENTS, document.getStorageKey())
                    .orElseThrow(() -> new NotFoundException("Файл документа недоступен"));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }

        // Запись в журнал обёрнута: поток из объектного хранилища уже открыт,
        // и если журнал упадёт, закрывать его будет некому — контроллер до
        // InputStreamResource не дойдёт. Пул соединений SDK не бесконечен,
        // и серия таких отказов останавливает скачивание документов до
        // перезапуска приложения.
        try {
            audit.record("public", "document.download", "document", slug,
                    Map.of("revision", document.getRevision() == null ? "-" : document.getRevision()));
        } catch (RuntimeException e) {
            closeQuietly(stored.data());
            throw e;
        }

        return new Download(filename(document), stored);
    }

    private static void closeQuietly(java.io.InputStream data) {
        try {
            data.close();
        } catch (IOException ignored) {
            // Мы уже падаем с другой причиной — она важнее этой.
        }
    }

    private static String filename(Document document) {
        var key = document.getStorageKey();
        var dot = key.lastIndexOf('.');
        var extension = dot < 0 ? "" : key.substring(dot);
        return document.getSlug() + extension;
    }
}
