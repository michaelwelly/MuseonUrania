package ru.vedal.portal.assistant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;

/**
 * Поиск по близости в индексе pgvector.
 *
 * <p><b>Пустой индекс — рабочее состояние.</b> Пока корпуса документов нет
 * (GitHub issue #38), индекс пуст, и этот класс честно ничего не находит:
 * пустой список, а дальше {@link RagRetrieval} отдаёт слово поиску по словам,
 * то есть ассистент отвечает ровно так же, как отвечал до pgvector. Ни отказа,
 * ни выдуманного ответа — просто «здесь не нашлось».
 *
 * <p><b>Пустой индекс не стоит денег.</b> Вопрос превращается в вектор
 * вызовом модели, то есть за деньги. На пустом индексе результат известен
 * заранее, поэтому сначала спрашивается база — есть ли вообще что искать, —
 * и только потом модель. Пока корпуса нет, это единственный запрос, который
 * ассистент делает сверх прежнего.
 *
 * <p><b>Отказ эмбеддингов — не отказ ассистента.</b> Молчание облака здесь
 * означает «векторный поиск ничего не дал», и разговор продолжается поиском
 * по словам. Правило то же, что у {@link YandexGptEngine}: чужая
 * недоступность не должна выглядеть для посетителя как наша поломка.
 */
public class VectorSearch implements Retrieval {

    private static final Logger log = LoggerFactory.getLogger(VectorSearch.class);

    /**
     * Сколько источников попадает в ответ.
     *
     * <p>Столько же, сколько у поиска по словам: это предел ответа, а не
     * предел поиска, и он не должен зависеть от того, кто искал.
     */
    private static final int MAX_SOURCES = 4;

    /**
     * Сколько фрагментов рассматривается, прежде чем свернуться в источники.
     *
     * <p>Больше, чем источников, и намеренно: длинный документ даёт много
     * фрагментов, и первые четыре по расстоянию легко окажутся четырьмя
     * кусками одного буклета. Тогда ответ опирается на один материал,
     * а выглядит как опирающийся на четыре.
     */
    private static final int CANDIDATES = 24;

    private final JdbcClient jdbc;
    private final Embeddings embeddings;

    /**
     * Насколько далёкий фрагмент ещё считается ответом.
     *
     * <p>Косинусное расстояние: 0 — то же самое, 1 — ничего общего.
     * Порог нужен по той же причине, по которой он есть у поиска по словам:
     * ближайший фрагмент находится всегда, даже для вопроса про погоду,
     * и без порога ассистент отвечал бы каталогом на что угодно.
     *
     * <p>Значение настраиваемое и до появления корпуса заведомо неточное:
     * калибровать порог можно только на настоящих документах и настоящих
     * вопросах. Поэтому оно и вынесено в настройку, а не прошито здесь.
     */
    private final double maxDistance;

    public VectorSearch(JdbcClient jdbc, Embeddings embeddings, double maxDistance) {
        this.jdbc = jdbc;
        this.embeddings = embeddings;
        this.maxDistance = maxDistance;
    }

    @Override
    public List<Passage> find(String question, LlmEngine.Scope scope) {
        if (question == null || question.isBlank()) return List.of();
        if (isEmpty()) return List.of();

        float[] vector;
        try {
            vector = embeddings.ofQuery(question);
        } catch (RuntimeException e) {
            log.warn("Эмбеддинги не ответили, векторный поиск пропущен: {}", e.toString());
            return List.of();
        }

        // Область подставляется из этой строки, а не из параметра: значения
        // приходят из перечисления, а не снаружи, и склеивать SQL с наружным
        // значением здесь неоткуда.
        var visible = scope == LlmEngine.Scope.STAFF ? "'public', 'internal'" : "'public'";

        var rows = jdbc.sql("""
                        select s.kind, s.title, s.url, c.text,
                               (c.embedding <=> cast(:question as vector)) as distance
                        from knowledge_chunk c
                        join knowledge_source s on s.id = c.source_id
                        where s.visibility in (%s)
                          and c.model = :model
                        order by c.embedding <=> cast(:question as vector)
                        limit :candidates
                        """.formatted(visible))
                .param("question", KnowledgeIndex.literal(vector))
                // Чанки, посчитанные другой моделью, не рассматриваются вовсе.
                // Расстояние до них считается, но ничего не значит: векторы
                // разных моделей лежат в разных пространствах. Лучше не найти
                // ничего, чем найти неизвестно что.
                .param("model", embeddings.name())
                .param("candidates", CANDIDATES)
                .query((rs, at) -> new Hit(rs.getString("kind"), rs.getString("title"),
                        rs.getString("url"), rs.getString("text"), rs.getDouble("distance")))
                .list();

        var passages = new ArrayList<Passage>();
        var seen = new HashSet<String>();
        for (var hit : rows) {
            if (hit.distance() > maxDistance) continue;
            // Один материал — один источник в ответе. Второй фрагмент того же
            // документа занял бы место другого материала, а читателю показал бы
            // ту же ссылку дважды.
            if (!seen.add(hit.url())) continue;
            passages.add(new Passage(
                    new LlmEngine.Source(hit.title(), hit.url(), hit.kind()), hit.text()));
            if (passages.size() == MAX_SOURCES) break;
        }
        return List.copyOf(passages);
    }

    /**
     * Есть ли в индексе хоть что-нибудь.
     *
     * <p>{@code exists}, а не {@code count}: считать строки, чтобы узнать,
     * есть ли хоть одна, — это обход таблицы там, где хватает первой
     * найденной.
     */
    private boolean isEmpty() {
        return Boolean.FALSE.equals(
                jdbc.sql("select exists (select 1 from knowledge_chunk)")
                        .query(Boolean.class)
                        .single());
    }

    private record Hit(String kind, String title, String url, String text, double distance) {}
}
