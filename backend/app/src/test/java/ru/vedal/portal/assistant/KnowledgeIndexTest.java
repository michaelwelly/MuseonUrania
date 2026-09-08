package ru.vedal.portal.assistant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.support.TransactionTemplate;
import ru.vedal.portal.PostgresTestBase;
import ru.vedal.portal.catalog.CatalogQuery;
import ru.vedal.portal.content.ContentQuery;
import ru.vedal.portal.documents.DocumentQuery;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Индексация материала в pgvector.
 *
 * <p>Материалы здесь синтетические и намеренно не похожи на данные VEDAL:
 * кубики и шары с полигона. Корпус документов заказчик ещё не передал
 * (GitHub issue #38), а сочинять содержимое датащитов, характеристики
 * и статусы регистрации ради теста запрещено правилами проекта. Индексации
 * всё равно, что резать и что считать, — проверяется она.
 */
class KnowledgeIndexTest extends PostgresTestBase {

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

    private final SyntheticEmbeddings embeddings = new SyntheticEmbeddings();

    private KnowledgeIndex index() {
        return new KnowledgeIndex(jdbc, transactions, embeddings, catalog, content, documents);
    }

    private static KnowledgeIndex.Material cube(String text) {
        return new KnowledgeIndex.Material("page", "polygon-cube",
                "Полигон: красный кубик", "/polygon/cube/", "ru", "public", text);
    }

    @Test
    void aMaterialBecomesSourceAndChunks() {
        var outcome = index().index(cube("Синтетический материал полигона. Красный кубик."));

        assertThat(outcome).isEqualTo(KnowledgeIndex.Outcome.INDEXED);
        assertThat(index().stats().sources()).isEqualTo(1);
        assertThat(index().stats().chunks()).isEqualTo(1);
        assertThat(chunkTexts()).allMatch(text -> text.contains("кубик"));
    }

    // Каждый фрагмент — это вызов модели, то есть счёт. Материал, текст
    // которого не менялся, не должен стоить ничего.
    @Test
    void anUnchangedMaterialIsNotSentToTheModelAgain() {
        var index = index();
        index.index(cube("Синтетический материал полигона. Красный кубик."));
        var afterFirst = embeddings.documentCalls;

        var outcome = index.index(cube("Синтетический материал полигона. Красный кубик."));

        assertThat(outcome).isEqualTo(KnowledgeIndex.Outcome.UNCHANGED);
        assertThat(embeddings.documentCalls)
                .as("отпечаток совпал — модель спрашивать незачем")
                .isEqualTo(afterFirst);
    }

    // Изменившийся материал режется заново, и новых фрагментов может быть
    // меньше. Дописывание оставило бы хвост старой нарезки — выдержки
    // из текста, которого на сайте уже нет.
    @Test
    void changedTextReplacesTheOldChunksInsteadOfAddingToThem() {
        var index = index();
        index.index(cube(longText("кубик", 30)));
        var before = index.stats().chunks();

        index.index(cube("Синтетический материал полигона. Теперь просто зелёный шар."));

        assertThat(before).isGreaterThan(1);
        assertThat(index.stats().sources()).isEqualTo(1);
        assertThat(index.stats().chunks()).isEqualTo(1);
        assertThat(chunkTexts()).allMatch(text -> text.contains("шар"));
    }

    // Снятие с публикации обязано убирать материал из индекса так же, как
    // оно убирает его с сайта: иначе на сайте его нет, а ассистент про него
    // рассказывает.
    @Test
    void forgettingAMaterialTakesItsChunksWithIt() {
        var index = index();
        index.index(cube(longText("кубик", 10)));

        assertThat(index.forget("page", "polygon-cube")).isTrue();
        assertThat(index.stats()).isEqualTo(new KnowledgeIndex.Stats(0, 0));
    }

    @Test
    void aMaterialWithoutTextIsNotIndexedAtAll() {
        var index = index();

        assertThat(index.index(cube("   "))).isEqualTo(KnowledgeIndex.Outcome.EMPTY);
        assertThat(index.stats()).isEqualTo(new KnowledgeIndex.Stats(0, 0));
        assertThat(embeddings.documentCalls).isZero();
    }

    // Смена модели эмбеддингов делает старые векторы несравнимыми с новыми.
    // Без модели в отпечатке материал считался бы неизменившимся и остался
    // бы в индексе мёртвым грузом.
    @Test
    void changingTheEmbeddingModelForcesAReindex() {
        var text = "Синтетический материал полигона. Красный кубик.";
        index().index(cube(text));

        var another = new SyntheticEmbeddings("emb://polygon/synthetic-doc-v2/latest");
        var outcome = new KnowledgeIndex(jdbc, transactions, another, catalog, content, documents)
                .index(cube(text));

        assertThat(outcome).isEqualTo(KnowledgeIndex.Outcome.INDEXED);
        assertThat(jdbc.sql("select distinct model from knowledge_chunk").query(String.class).list())
                .containsExactly("emb://polygon/synthetic-doc-v2/latest");
    }

    // Переиндексация берёт ровно то, что портал и так показывает, — через
    // те же запросные интерфейсы соседей. Ни одного нового поля и ни одного
    // нового источника: закрытые материалы недостижимы здесь по той же
    // причине, что и в поиске по словам.
    @Test
    void reindexingPublishedMaterialTakesOnlyWhatThePortalAlreadyShows() {
        var stats = index().reindexPublished();

        assertThat(stats.sources()).isEqualTo(catalog.publishedProducts().size()
                + content.publishedNews().size() + documents.listedDocuments().size());
        assertThat(jdbc.sql("select distinct visibility from knowledge_source")
                .query(String.class).list())
                .as("в индекс попадает только публичное")
                .containsExactly("public");
    }

    private java.util.List<String> chunkTexts() {
        return jdbc.sql("select text from knowledge_chunk order by position")
                .query(String.class)
                .list();
    }

    /** Длинный синтетический материал: столько абзацев, чтобы нарезка сработала. */
    private static String longText(String marker, int paragraphs) {
        var text = new StringBuilder();
        for (var at = 0; at < paragraphs; at++) {
            text.append("Абзац ").append(at)
                    .append(" описывает синтетическую фигуру полигона: ").append(marker)
                    .append(", заведённую исключительно для проверки индексации.\n\n");
        }
        return text.toString();
    }
}
