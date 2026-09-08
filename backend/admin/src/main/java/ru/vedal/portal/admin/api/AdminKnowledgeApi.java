package ru.vedal.portal.admin.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.vedal.portal.assistant.KnowledgeIndex;
import ru.vedal.portal.audit.AuditLog;
import ru.vedal.portal.common.ConflictException;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Индекс Ведалины в админке: что в нём лежит и кнопка «переиндексировать».
 *
 * <p><b>Зачем кнопка.</b> Индекс догоняет правку сам — событие документа
 * поднимает переиндексацию. Но событие бывает пропущено: индексация была
 * выключена, когда документ правили; ключ эмбеддингов не доехал; событие
 * ушло в DLQ. Без ручной кнопки единственный способ собрать индекс заново —
 * перезапуск с правкой настроек, то есть работа для того, у кого есть SSH.
 *
 * <p><b>Зачем состояние рядом с кнопкой.</b> Кнопка, после которой ничего
 * не видно, не отличается от кнопки, которая ничего не делает. Здесь рядом
 * лежит то, что позволяет это проверить: сколько материалов в индексе,
 * сколько у каждого фрагментов и когда он туда попал.
 *
 * <p><b>Выключенный RAG — не отказ.</b> По умолчанию индексация выключена
 * (индексировать нечего, а каждый вопрос стоил бы вызова модели).
 * Дверь при этом отвечает честно: {@code enabled: false} и пустой список,
 * а не пятисотая и не пустой индекс, неотличимый от собранного.
 *
 * <p>Адрес отдельный, а не под {@code /assistant}: там дверь открыта всем
 * трём ролям портала — спрашивать Ведалину имеет право и продавец. Собирать
 * индекс сайта — работа того, кто ведёт содержимое, и правило доступа
 * у неё своё.
 */
@RestController
@RequestMapping("/api/admin/v1/knowledge")
@Tag(name = "Админка: индекс Ведалины")
@SecurityRequirement(name = "keycloak")
public class AdminKnowledgeApi {

    @Schema(name = "KnowledgeState", description = "Состояние индекса Ведалины.")
    public record State(

            @Schema(description = "Индексация включена (`vedal.assistant.rag.enabled`). "
                    + "Выключена — индекс пуст, а ассистент отвечает поиском по словам.")
            boolean enabled,

            @Schema(description = "Сколько материалов лежит в индексе.")
            int sources,

            @Schema(description = "Сколько всего фрагментов.")
            int chunks,

            @Schema(description = "Что именно лежит в индексе.")
            List<Row> rows) {}

    @Schema(name = "KnowledgeRow", description = "Материал в индексе.")
    public record Row(
            @Schema(description = "Вид материала.",
                    allowableValues = {"product", "news", "document", "page"}, example = "document")
            String kind,

            @Schema(description = "Идентификатор материала у его модуля.",
                    example = "opisanie-izdeliya-vedal-r1-r2")
            String externalId,

            @Schema(description = "Название, которое показывается под ответом.")
            String title,

            @Schema(description = "Сколько фрагментов нарезано из материала.")
            int chunks,

            @Schema(description = "Когда материал попал в индекс.")
            Instant indexedAt) {}

    // Бина индекса нет вовсе, пока индексация выключена. ObjectProvider,
    // а не Optional-поле: дверь обязана отвечать и без него, а не исчезать
    // вместе с ним — иначе админка получала бы 404 и не могла отличить
    // «выключено» от «двери нет».
    private final ObjectProvider<KnowledgeIndex> index;
    private final AuditLog audit;

    public AdminKnowledgeApi(ObjectProvider<KnowledgeIndex> index, AuditLog audit) {
        this.index = index;
        this.audit = audit;
    }

    @Operation(summary = "Состояние индекса Ведалины",
            description = """
                    Сколько материалов и фрагментов лежит в индексе и когда каждый
                    материал туда попал.

                    Если индексация выключена (`vedal.assistant.rag.enabled=false`),
                    приходит `enabled: false` и пустой список — это рабочее
                    состояние, а не ошибка: ассистент отвечает поиском по словам.
                    """)
    @ApiResponse(responseCode = "200", description = "Состояние индекса.")
    @GetMapping
    public State state() {
        var knowledge = index.getIfAvailable();
        if (knowledge == null) return new State(false, 0, 0, List.of());

        var stats = knowledge.stats();
        return new State(true, stats.sources(), stats.chunks(), rows(knowledge));
    }

    @Operation(summary = "Переиндексировать опубликованное",
            description = """
                    Собирает индекс заново по тому, что портал показывает сегодня:
                    опубликованные изделия, новости и перечень документов.
                    Текст опубликованных PDF и DOCX извлекается из файлов.

                    Материал с неизменившимся текстом переиндексирован не будет:
                    отпечаток сверяется до того, как посчитан хоть один вектор.
                    Поэтому повторное нажатие ничего не стоит.

                    Закрытые материалы сюда не попадают: индекс собирается через те же
                    запросные интерфейсы, что и поиск по словам, и документы уровня
                    `internal` и `confidential` им недоступны.

                    Действие записывается в журнал на того, кто его запустил.
                    """)
    @ApiResponse(responseCode = "200", description = "Индекс собран; в ответе — его состояние.")
    @ApiResponse(responseCode = "409", description = "Индексация выключена настройкой.")
    @PostMapping("/reindex")
    public State reindex(Authentication authentication) {
        var knowledge = index.getIfAvailable();
        if (knowledge == null) {
            throw new ConflictException("""
                    Индексация выключена: vedal.assistant.rag.enabled=false. \
                    Собирать нечего и незачем — ассистент отвечает поиском \
                    по словам. Включается переменными VEDAL_RAG_ENABLED, \
                    VEDAL_RAG_DOCUMENT_MODEL_URI и VEDAL_RAG_QUERY_MODEL_URI.""");
        }

        var stats = knowledge.reindexPublished();

        // Переиндексация стоит денег — каждый новый фрагмент это вызов
        // модели. След в журнале обязателен: иначе счёт за эмбеддинги
        // не с кем сопоставить.
        //
        // Своей транзакцией по той же причине, что и в AdminStaffApi:
        // `record` объявлен MANDATORY, а обработчик не в транзакции —
        // сборка индекса закрывает свои собственные и возвращается
        // наружу ни в какой. Общая транзакция здесь и не нужна: индекс
        // уже собран и оплачен, откатывать нечего, а потерянная запись
        // означала бы неоплаченный счёт без хозяина (issue #95).
        audit.recordIndependently(Actor.of(authentication), "assistant.reindex", "knowledge", "published",
                Map.of("sources", stats.sources(), "chunks", stats.chunks()));

        return new State(true, stats.sources(), stats.chunks(), rows(knowledge));
    }

    private static List<Row> rows(KnowledgeIndex knowledge) {
        return knowledge.indexed().stream()
                .map(row -> new Row(row.kind(), row.externalId(), row.title(),
                        row.chunks(), row.indexedAt()))
                .toList();
    }
}
