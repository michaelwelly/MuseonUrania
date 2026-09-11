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
 * Поиск по близости и что он делает с пустым индексом.
 *
 * <p>Корпус здесь синтетический — кубики, шары и пирамиды с полигона.
 * Настоящих документов VEDAL ещё нет (GitHub issue #38), а сочинять их ради
 * теста запрещено правилами проекта: поиску по близости всё равно, что лежит
 * в индексе, и проверяется он, а не содержимое.
 */
class VectorSearchTest extends PostgresTestBase {

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
    SitePages pages;

    @Autowired
    DeterministicSearch words;

    private final SyntheticEmbeddings embeddings = new SyntheticEmbeddings();

    private KnowledgeIndex index() {
        return new KnowledgeIndex(jdbc, transactions, embeddings, catalog, content, documents, pages);
    }

    private VectorSearch search() {
        return new VectorSearch(jdbc, embeddings, 0.45);
    }

    private void put(String id, String title, String visibility, String text) {
        index().index(new KnowledgeIndex.Material("page", id, title,
                "/polygon/" + id + "/", "ru", visibility, text));
    }

    // Главная проверка задачи: пустой индекс — рабочее состояние. Ассистент
    // не падает, ничего не выдумывает и не платит за вызов модели.
    @Test
    void anEmptyIndexFindsNothingAndCostsNothing() {
        var found = search().find("расскажите про красный кубик", LlmEngine.Scope.PUBLIC);

        assertThat(found).isEmpty();
        assertThat(embeddings.queryCalls)
                .as("на пустом индексе результат известен заранее — "
                        + "спрашивать модель незачем")
                .isZero();
    }

    // И то же самое целиком: с пустым индексом ассистент отвечает ровно тем,
    // чем отвечал до pgvector.
    @Test
    void withAnEmptyIndexTheAssistantStillAnswersByWords() {
        var retrieval = new RagRetrieval(search(), words);

        var found = retrieval.find("Что такое VEDAL A-2000?", LlmEngine.Scope.PUBLIC);

        assertThat(found).isNotEmpty();
        assertThat(found.getFirst().source().url()).startsWith("/products/");
    }

    @Test
    void theNearestMaterialIsTheOneTheQuestionIsAbout() {
        put("cube", "Полигон: красный кубик", "public",
                "Синтетический материал полигона. Красный кубик и ещё раз кубик.");
        put("ball", "Полигон: зелёный шар", "public",
                "Синтетический материал полигона. Зелёный шар и ещё раз шар.");

        var found = search().find("расскажите про кубик", LlmEngine.Scope.PUBLIC);

        assertThat(found).extracting(p -> p.source().title())
                .containsExactly("Полигон: красный кубик");
    }

    // Порог нужен затем же, зачем он есть у поиска по словам: ближайший
    // фрагмент находится всегда, и без порога ассистент отвечал бы корпусом
    // на вопрос про погоду.
    @Test
    void aQuestionAboutSomethingElseFindsNothing() {
        put("cube", "Полигон: красный кубик", "public",
                "Синтетический материал полигона. Красный кубик.");

        var found = search().find("какая сегодня погода", LlmEngine.Scope.PUBLIC);

        assertThat(found).isEmpty();
    }

    // Один материал — один источник в ответе. Второй фрагмент того же
    // документа занял бы место другого материала, а читателю показал бы
    // ту же ссылку дважды.
    @Test
    void oneMaterialGivesOneSourceEvenWhenManyChunksMatch() {
        var text = new StringBuilder();
        for (var at = 0; at < 30; at++) {
            text.append("Абзац ").append(at)
                    .append(" описывает синтетическую фигуру полигона: кубик, ")
                    .append("заведённую исключительно для проверки поиска.\n\n");
        }
        put("cube", "Полигон: красный кубик", "public", text.toString());

        var found = search().find("расскажите про кубик", LlmEngine.Scope.PUBLIC);

        assertThat(index().stats().chunks()).isGreaterThan(1);
        assertThat(found).hasSize(1);
        assertThat(found.getFirst().text().length()).isGreaterThan(Chunks.MAX);
    }

    // Область — не фильтр поверх выдачи, а условие запроса. Внутренний
    // материал посетителю недостижим, и это единственное место, где области
    // расходятся.
    @Test
    void anInternalMaterialIsInvisibleToAVisitorAndVisibleToStaff() {
        put("cube", "Полигон: внутренний кубик", "internal",
                "Синтетический материал полигона. Внутренний кубик.");

        assertThat(search().find("расскажите про кубик", LlmEngine.Scope.PUBLIC)).isEmpty();
        assertThat(search().find("расскажите про кубик", LlmEngine.Scope.STAFF))
                .extracting(p -> p.source().title())
                .containsExactly("Полигон: внутренний кубик");
    }

    // Векторы разных моделей лежат в разных пространствах: расстояние до
    // чужого чанка считается, а смысла не имеет. Лучше не найти ничего,
    // чем найти неизвестно что.
    @Test
    void chunksFromAnotherModelAreNotSearchedAtAll() {
        put("cube", "Полигон: красный кубик", "public",
                "Синтетический материал полигона. Красный кубик.");

        var another = new VectorSearch(jdbc,
                new SyntheticEmbeddings("emb://polygon/synthetic-doc-v2/latest"), 0.45);

        assertThat(another.find("расскажите про кубик", LlmEngine.Scope.PUBLIC)).isEmpty();
    }

    // Молчание облака — не поломка ассистента: векторный поиск ничего
    // не даёт, разговор продолжается поиском по словам.
    @Test
    void aFailingEmbeddingModelDegradesToTheWordSearch() {
        put("cube", "Полигон: красный кубик", "public",
                "Синтетический материал полигона. Красный кубик.");

        var broken = new VectorSearch(jdbc, new SyntheticEmbeddings() {
            @Override
            public float[] ofQuery(String text) {
                throw new IllegalStateException("Эмбеддинги недоступны");
            }
        }, 0.45);

        assertThat(broken.find("расскажите про кубик", LlmEngine.Scope.PUBLIC)).isEmpty();
        assertThat(new RagRetrieval(broken, words)
                .find("Что такое VEDAL A-2000?", LlmEngine.Scope.PUBLIC))
                .isNotEmpty();
    }
}
