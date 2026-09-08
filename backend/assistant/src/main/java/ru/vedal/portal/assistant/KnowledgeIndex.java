package ru.vedal.portal.assistant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.support.TransactionTemplate;
import ru.vedal.portal.catalog.CatalogQuery;
import ru.vedal.portal.content.ContentQuery;
import ru.vedal.portal.documents.DocumentQuery;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;

import java.util.UUID;

/**
 * Индексация материала: текст — в фрагменты, фрагменты — в векторы.
 *
 * <p><b>Что здесь есть до корпуса.</b> Корпуса документов у VEDAL ещё нет
 * (GitHub issue #38), но индексировать уже есть что: опубликованные изделия,
 * новости и карточки документов — ровно те материалы, которые ассистент
 * и так показывает. Ничего нового в них не появляется; появляется другой
 * способ их найти.
 *
 * <p><b>Чего здесь нет и появится с корпусом.</b> Извлечения текста из PDF
 * и DOCX. Оно не написано намеренно: разбор файла проверяется файлами,
 * а придумывать содержимое датащитов VEDAL, чтобы было на чём проверить,
 * запрещено правилами проекта. {@link Material} принимает уже готовый текст,
 * и в тот день, когда появятся файлы, к нему добавляется извлечение —
 * а не переписывается всё остальное.
 *
 * <p><b>Про деньги.</b> Каждый фрагмент — это вызов модели эмбеддингов,
 * то есть счёт. Поэтому материал с неизменившимся текстом не
 * переиндексируется вовсе: отпечаток сравнивается до того, как хоть один
 * вектор будет посчитан.
 */
public class KnowledgeIndex {

    private static final Logger log = LoggerFactory.getLogger(KnowledgeIndex.class);

    /**
     * Материал для индекса.
     *
     * @param kind       {@code product}, {@code news}, {@code document} или {@code page};
     * @param externalId как материал зовётся у своего модуля — slug;
     * @param title      что показать под ответом;
     * @param url        куда вести читателя;
     * @param language   язык материала;
     * @param visibility {@code public} или {@code internal}. Уровня
     *                   {@code confidential} здесь нет: такие материалы
     *                   в индекс не попадают вовсе;
     * @param text       опубликованный текст. Всё, чего в нём нет, для модели
     *                   не существует.
     */
    public record Material(String kind, String externalId, String title, String url,
                           String language, String visibility, String text) {}

    /** Чем кончилась индексация одного материала. */
    public enum Outcome {
        /** Текст изменился (или материала не было) — чанки пересчитаны. */
        INDEXED,
        /** Отпечаток совпал — модель не спрашивалась. */
        UNCHANGED,
        /** Текста нет — индексировать нечего, материал в индекс не попадает. */
        EMPTY
    }

    /** Сколько всего лежит в индексе. */
    public record Stats(int sources, int chunks) {}

    private final JdbcClient jdbc;
    private final TransactionTemplate transactions;
    private final Embeddings embeddings;
    private final CatalogQuery catalog;
    private final ContentQuery content;
    private final DocumentQuery documents;

    public KnowledgeIndex(JdbcClient jdbc, TransactionTemplate transactions, Embeddings embeddings,
                          CatalogQuery catalog, ContentQuery content, DocumentQuery documents) {
        this.jdbc = jdbc;
        this.transactions = transactions;
        this.embeddings = embeddings;
        this.catalog = catalog;
        this.content = content;
        this.documents = documents;
    }

    /**
     * Положить материал в индекс.
     *
     * <p><b>Почему обращения к модели вне транзакции.</b> Эмбеддинги — это
     * сеть и секунды: держать на них открытую транзакцию значит держать
     * соединение с базой всё время, пока отвечает облако. Сначала считаются
     * все векторы, и только потом, одним коротким заходом, заменяются строки.
     *
     * <p><b>Почему замена, а не дописывание.</b> Изменившийся материал режется
     * заново, и новых фрагментов может быть меньше, чем было. Дописывание
     * оставило бы хвост старой нарезки — выдержки из текста, которого
     * на сайте уже нет.
     */
    public Outcome index(Material material) {
        var chunks = Chunks.of(material.text());
        if (chunks.isEmpty()) {
            forget(material.kind(), material.externalId());
            return Outcome.EMPTY;
        }

        var checksum = checksum(material);
        if (checksum.equals(currentChecksum(material))) return Outcome.UNCHANGED;

        var vectors = new ArrayList<float[]>(chunks.size());
        for (var chunk : chunks) {
            vectors.add(embeddings.ofDocument(chunk));
        }

        transactions.executeWithoutResult(status -> {
            deleteSource(material.kind(), material.externalId());

            var sourceId = UUID.randomUUID();
            jdbc.sql("""
                            insert into knowledge_source
                                (id, kind, external_id, title, url, visibility, language, checksum)
                            values (:id, :kind, :externalId, :title, :url, :visibility, :language, :checksum)
                            """)
                    .param("id", sourceId)
                    .param("kind", material.kind())
                    .param("externalId", material.externalId())
                    .param("title", material.title())
                    .param("url", material.url())
                    .param("visibility", material.visibility())
                    .param("language", material.language())
                    .param("checksum", checksum)
                    .update();

            for (var at = 0; at < chunks.size(); at++) {
                jdbc.sql("""
                                insert into knowledge_chunk
                                    (id, source_id, position, text, model, embedding)
                                values (:id, :sourceId, :position, :text, :model, cast(:embedding as vector))
                                """)
                        .param("id", UUID.randomUUID())
                        .param("sourceId", sourceId)
                        .param("position", at)
                        .param("text", chunks.get(at))
                        .param("model", embeddings.name())
                        .param("embedding", literal(vectors.get(at)))
                        .update();
            }
        });

        return Outcome.INDEXED;
    }

    /**
     * Убрать материал из индекса.
     *
     * <p>Нужно не только при удалении: снятие с публикации обязано убирать
     * материал отсюда так же, как оно убирает его с сайта. Оставленный
     * в индексе снятый документ — это ровно то нарушение правила «наружу
     * уходит только опубликованное», которое никто не заметит: на сайте
     * его нет, а ассистент про него рассказывает.
     */
    public boolean forget(String kind, String externalId) {
        return transactions.execute(status -> deleteSource(kind, externalId) > 0);
    }

    public Stats stats() {
        var sources = jdbc.sql("select count(*) from knowledge_source").query(Integer.class).single();
        var chunks = jdbc.sql("select count(*) from knowledge_chunk").query(Integer.class).single();
        return new Stats(sources, chunks);
    }

    /**
     * Переиндексировать всё, что портал показывает сегодня.
     *
     * <p>Берётся ровно то же, что видит {@link DeterministicSearch}, — через
     * те же запросные интерфейсы соседей. Ни одного нового поля, ни одного
     * нового источника: закрытые материалы недостижимы здесь по той же
     * причине, что и там, — их не отдают интерфейсы.
     *
     * <p>Область — только {@code public}: перечень документов сотрудника
     * ({@code internal}) сюда не берётся, пока не появится корпус и вместе
     * с ним решение о втором контуре индексации. Индекс, в котором лежат
     * внутренние материалы, обязан фильтроваться на каждом запросе, а пустой
     * от них — не обязан ничем.
     */
    public Stats reindexPublished() {
        for (var product : catalog.publishedProducts()) {
            index(new Material("product", product.slug(),
                    product.name() + " — " + product.kind(),
                    "/products/" + product.slug() + "/", "ru", "public",
                    join(product.summary(), "Разделы: " + String.join(", ", product.categories()))));
        }

        for (var news : content.publishedNews()) {
            index(new Material("news", news.slug(), news.title(), "/news/", "ru", "public",
                    join(news.tag(), news.excerpt())));
        }

        for (var document : documents.listedDocuments()) {
            // Статус доступа идёт в текст материала, а не только в подпись:
            // без него выдержка про «Регистрационное удостоверение» читается
            // как утверждение, что удостоверение есть. Правило то же, что
            // и в поиске по словам.
            index(new Material("document", document.slug(),
                    label(document),
                    document.published() ? document.fileUrl() : "/documents/", "ru", "public",
                    join("Раздел: " + document.group(), "Относится к: " + document.subject(),
                            "pending".equals(document.access())
                                    ? "Статус: наличие уточняется"
                                    : "Статус: опубликован")));
        }

        var stats = stats();
        log.info("Индекс Ведалины: {} материалов, {} фрагментов", stats.sources(), stats.chunks());
        return stats;
    }

    private static String label(DocumentQuery.Card card) {
        var title = card.title() + " — " + card.subject();
        return "pending".equals(card.access()) ? title + " (статус уточняется)" : title;
    }

    private static String join(String... parts) {
        var body = new StringBuilder();
        for (var part : parts) {
            if (part == null || part.isBlank()) continue;
            if (!body.isEmpty()) body.append(". ");
            body.append(part.strip());
        }
        return body.toString();
    }

    private int deleteSource(String kind, String externalId) {
        // Чанки уносит `on delete cascade`: осиротевший чанк — это выдержка
        // со ссылкой на материал, которого в индексе уже нет.
        return jdbc.sql("delete from knowledge_source where kind = :kind and external_id = :id")
                .param("kind", kind)
                .param("id", externalId)
                .update();
    }

    private String currentChecksum(Material material) {
        return jdbc.sql("""
                        select checksum from knowledge_source
                        where kind = :kind and external_id = :id
                        """)
                .param("kind", material.kind())
                .param("id", material.externalId())
                .query(String.class)
                .optional()
                .orElse("");
    }

    /**
     * Отпечаток материала.
     *
     * <p>Считается не по одному тексту: заголовок и адрес тоже показываются
     * под ответом, и переименованное изделие обязано переиндексироваться,
     * даже если описание осталось прежним.
     *
     * <p>В отпечаток входит и модель. Смена модели эмбеддингов делает старые
     * векторы несравнимыми с новыми, и без этого материал считался бы
     * «неизменившимся» — то есть остался бы в индексе мёртвым грузом.
     */
    private String checksum(Material material) {
        var payload = String.join(" ", embeddings.name(), material.title(),
                material.url(), material.visibility(), material.language(), material.text());
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("В этой JVM нет SHA-256", e);
        }
    }

    /**
     * Вектор в том виде, в каком его понимает pgvector: {@code [1,2,3]}.
     *
     * <p>Через строку и {@code cast(... as vector)}, а не через массив
     * драйвера: у типа расширения нет своего JDBC-типа, и параметр-массив
     * доехал бы до базы как {@code float8[]}, который в {@code vector}
     * сам не превращается.
     */
    static String literal(float[] vector) {
        var body = new StringBuilder("[");
        for (var at = 0; at < vector.length; at++) {
            if (at > 0) body.append(',');
            body.append(vector[at]);
        }
        return body.append(']').toString();
    }
}
