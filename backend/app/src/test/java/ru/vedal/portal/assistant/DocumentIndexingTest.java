package ru.vedal.portal.assistant;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.support.TransactionTemplate;
import ru.vedal.portal.PostgresTestBase;
import ru.vedal.portal.catalog.CatalogQuery;
import ru.vedal.portal.common.Outbox;
import ru.vedal.portal.content.ContentQuery;
import ru.vedal.portal.documents.DocumentAdmin;
import ru.vedal.portal.documents.DocumentQuery;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Документ с файлом попадает в индекс текстом, а не одним названием.
 *
 * <p><b>Документы здесь заведомо синтетические — про полигон и кубики.</b>
 * Корпуса заказчик ещё не передал (GitHub issue #38), а сочинять содержимое
 * датащитов VEDAL, характеристики, сертификаты и статусы регистрации ради
 * теста запрещено правилами проекта. Конвейеру «файл → текст → фрагменты →
 * векторы» всё равно, что внутри файла, — проверяется он.
 *
 * <p>Документы заводятся настоящей дверью правки, а не строкой в базе:
 * проверяется в том числе то, что событие о правке доезжает до индекса.
 */
class DocumentIndexingTest extends PostgresTestBase {

    @Autowired
    JdbcClient jdbc;

    @Autowired
    TransactionTemplate transactions;

    @Autowired
    CatalogQuery catalog;

    @Autowired
    ContentQuery content;

    @Autowired
    DocumentQuery documents;

    @Autowired
    DocumentAdmin editor;

    private final SyntheticEmbeddings embeddings = new SyntheticEmbeddings();

    private KnowledgeIndex index() {
        return new KnowledgeIndex(jdbc, transactions, embeddings, catalog, content, documents);
    }

    // ————— текст файла —————

    @Test
    void thePublishedFileTextGetsIntoTheIndex() throws IOException {
        published("polygon-cube-sheet", pdf("The polygon cube is a synthetic figure."));

        index().indexDocument("polygon-cube-sheet");

        assertThat(chunksOf("polygon-cube-sheet"))
                .as("в индексе лежит текст файла, а не только подпись карточки")
                .anyMatch(text -> text.contains("synthetic figure"));
    }

    // Файл снятого с публикации документа не отдаётся посетителю ни по
    // одному адресу. Его содержимое в ответе ассистента — то же нарушение
    // правила «наружу уходит только опубликованное», только незаметное:
    // ссылки нет, а текст пересказан.
    @Test
    void theFileOfAnUnpublishedDocumentStaysOutOfTheIndex() throws IOException {
        var id = published("polygon-cube-sheet", pdf("The polygon cube is a synthetic figure."));
        editor.setPublished(id, false, "тест");

        index().indexDocument("polygon-cube-sheet");

        assertThat(chunksOf("polygon-cube-sheet"))
                .as("карточка остаётся, текст файла — нет")
                .isNotEmpty()
                .noneMatch(text -> text.contains("synthetic figure"));
    }

    // Один битый файл не должен оставлять весь индекс несобранным.
    @Test
    void aFileThatCannotBeReadDoesNotBreakIndexing() {
        var id = published("polygon-cube-sheet", "это не PDF".getBytes(StandardCharsets.UTF_8));
        assertThat(id).isNotNull();

        var outcome = index().indexDocument("polygon-cube-sheet");

        assertThat(outcome).isEqualTo(KnowledgeIndex.Outcome.INDEXED);
        assertThat(chunksOf("polygon-cube-sheet"))
                .as("документ в индексе — карточкой")
                .isNotEmpty();
    }

    // Скан — это картинка: страницы есть, текста нет. Документ индексируется
    // карточкой, и это не отказ.
    @Test
    void aFileWithoutExtractableTextLeavesTheCardAlone() throws IOException {
        published("polygon-cube-sheet", pdf());

        index().indexDocument("polygon-cube-sheet");

        assertThat(chunksOf("polygon-cube-sheet")).isNotEmpty();
    }

    // ————— очередь индексации —————

    @Test
    void aDocumentEventReindexesJustThatDocument() throws IOException {
        published("polygon-cube-sheet", pdf("The polygon cube is a synthetic figure."));
        var indexer = new KnowledgeIndexer(index());

        indexer.consume(event("polygon-cube-sheet"));

        assertThat(chunksOf("polygon-cube-sheet"))
                .anyMatch(text -> text.contains("synthetic figure"));
        assertThat(sources())
                .as("событие про один документ не пересобирает весь индекс")
                .isEqualTo(1);
    }

    // Снятие с публикации обязано убирать материал из индекса так же, как
    // оно убирает его с сайта: иначе на сайте документа нет, а ассистент
    // про него рассказывает.
    @Test
    void unlistingADocumentTakesItOutOfTheIndex() throws IOException {
        var id = published("polygon-cube-sheet", pdf("The polygon cube is a synthetic figure."));
        var indexer = new KnowledgeIndexer(index());
        indexer.consume(event("polygon-cube-sheet"));
        assertThat(sources()).isEqualTo(1);

        editor.setPublished(id, false, "тест");
        var current = editor.document(id);
        editor.updateDocument(id,
                new DocumentAdmin.DocumentForm(current.version(), current.slug(), current.title(),
                        current.group(), current.subject(), null, "public", "pdf", false, null, null),
                "тест");

        indexer.consume(event("polygon-cube-sheet"));

        assertThat(sources()).isZero();
    }

    // Повтор — норма для доставки: она повторяет событие, если падение
    // случилось между обработкой и отметкой. Второй заход обязан быть
    // бесплатным: каждый фрагмент — это вызов модели, то есть счёт.
    @Test
    void aRepeatedEventCostsNoModelCalls() throws IOException {
        published("polygon-cube-sheet", pdf("The polygon cube is a synthetic figure."));
        var indexer = new KnowledgeIndexer(index());
        indexer.consume(event("polygon-cube-sheet"));
        var afterFirst = embeddings.documentCalls;

        indexer.consume(event("polygon-cube-sheet"));

        assertThat(embeddings.documentCalls).isEqualTo(afterFirst);
    }

    @Test
    void theIndexerAnswersOnlyForDocumentEvents() {
        var indexer = new KnowledgeIndexer(index());

        assertThat(indexer.handles("vedal.documents.v1")).isTrue();
        assertThat(indexer.handles("vedal.leads.v1")).isFalse();
        assertThat(indexer.handles("vedal.audit.v1")).isFalse();
    }

    // ————— состояние индекса для админки —————

    @Test
    void theIndexTellsWhatIsInsideIt() throws IOException {
        published("polygon-cube-sheet", pdf("The polygon cube is a synthetic figure."));
        var index = index();
        index.indexDocument("polygon-cube-sheet");

        assertThat(index.indexed())
                .singleElement()
                .satisfies(row -> {
                    assertThat(row.kind()).isEqualTo("document");
                    assertThat(row.externalId()).isEqualTo("polygon-cube-sheet");
                    assertThat(row.chunks()).isPositive();
                    assertThat(row.indexedAt()).isNotNull();
                });
    }

    // ————— вспомогательное —————

    /** Заводит документ перечня с файлом и публикует его. */
    private UUID published(String slug, byte[] file) {
        var created = editor.createDocument(form(slug, true), "тест");
        editor.uploadFile(created.id(),
                new DocumentAdmin.Upload(slug + ".pdf", new ByteArrayInputStream(file),
                        file.length, "application/pdf"),
                "тест");
        editor.setPublished(created.id(), true, "тест");
        return created.id();
    }

    private static DocumentAdmin.DocumentForm form(String slug, boolean listed) {
        return new DocumentAdmin.DocumentForm(null, slug,
                "Полигон: описание синтетической фигуры",
                "Техническая документация", "Полигон, синтетический кубик",
                null, "public", "pdf", listed, null, null);
    }

    private static Outbox event(String slug) {
        var event = new Outbox();
        event.setId(UUID.randomUUID());
        event.setAggregate("document");
        event.setAggregateId(slug);
        event.setType("vedal.documents.v1");
        event.setPayload("{}");
        return event;
    }

    private List<String> chunksOf(String slug) {
        return jdbc.sql("""
                        select c.text from knowledge_chunk c
                        join knowledge_source s on s.id = c.source_id
                        where s.kind = 'document' and s.external_id = :slug
                        order by c.position
                        """)
                .param("slug", slug)
                .query(String.class)
                .list();
    }

    private int sources() {
        return jdbc.sql("select count(*) from knowledge_source").query(Integer.class).single();
    }

    /**
     * Синтетический PDF: страница с латинскими строками.
     *
     * <p>Латиница, а не кириллица: у встроенных гарнитур PDF кириллических
     * знаков нет, и русская строка ими не запишется — понадобился бы вложенный
     * в файл шрифт, то есть полмегабайта двоичного TTF в репозитории ради
     * одного теста. Проверяется здесь путь «файл → индекс», а не поддержка
     * кодировок в разборщике.
     */
    private static byte[] pdf(String... lines) throws IOException {
        try (var document = new PDDocument(); var bytes = new ByteArrayOutputStream()) {
            var page = new PDPage();
            document.addPage(page);

            if (lines.length > 0) {
                try (var content = new PDPageContentStream(document, page)) {
                    content.beginText();
                    content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                    content.setLeading(16);
                    content.newLineAtOffset(50, 700);
                    for (var line : lines) {
                        content.showText(line);
                        content.newLine();
                    }
                    content.endText();
                }
            }

            document.save(bytes);
            return bytes.toByteArray();
        }
    }
}
