package ru.vedal.portal.assistant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;
import ru.vedal.portal.documents.Document;
import ru.vedal.portal.documents.DocumentRepository;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Ведалина не выдаёт неподтверждённый документ за подтверждённый (§10.5).
 *
 * Документ со статусом {@code pending} — это документ, наличие которого никто
 * не подтвердил. В перечне на сайте рядом с ним стоит «Уточняется». Ассистент
 * ту же строку выдавал без статуса, и «Сертификат ISO 13485 — Производство»
 * читалось как утверждение, что сертификат есть. Ровно это утверждение §6.4
 * плана убрала со страницы «Производство» вместе с блоком «Качество».
 *
 * Скрывать такие документы нельзя: на вопрос «есть ли ISO» пустой ответ
 * читается как «нет» — тоже утверждение, которого мы не знаем. Поэтому
 * проверяется не исчезновение строки, а наличие рядом с ней статуса.
 */
@AutoConfigureMockMvc
class UnconfirmedDocumentStatusTest extends PostgresTestBase {

    private static final String TITLE = "Сертификат электромагнитной совместимости";
    private static final String QUESTION = "сертификат электромагнитной совместимости";

    @Autowired
    MockMvc mvc;

    @Autowired
    DocumentRepository documents;

    // Проверяем ровно ту строку, что относится к нашему документу, а не
    // наличие слов где-то в ответе: в сиде уже лежат pending-документы
    // («Сертификат ISO 13485», «Декларация о соответствии»), и по слову
    // «сертификат» они попадают в тот же ответ. Проверка «в тексте есть
    // статус» проходила бы на них, ничего не доказывая про наш случай.
    private static final String PLAIN = TITLE + " — Производство";
    private static final String WITH_STATUS = PLAIN + " (статус уточняется)";

    @Test
    void unconfirmedDocumentIsNamedWithItsStatus() throws Exception {
        seed("pending");

        mvc.perform(ask(QUESTION))
                .andExpect(status().isOk())
                // Документ найден — молчанием правило не обходится.
                .andExpect(jsonPath("$.sources[?(@.title == '" + WITH_STATUS + "')]").exists())
                .andExpect(jsonPath("$.sources[?(@.title == '" + PLAIN + "')]").doesNotExist());
    }

    /**
     * Контрольный случай. Без него первый тест доказывал бы только то, что
     * статус кто-то где-то приписал, — а приписывать его каждому документу
     * подряд так же неверно: «выдаётся по запросу» и «неизвестно, есть ли» —
     * разные вещи.
     */
    @Test
    void confirmedDocumentIsNamedWithoutTheStatus() throws Exception {
        seed("on_request");

        mvc.perform(ask(QUESTION))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sources[?(@.title == '" + PLAIN + "')]").exists())
                .andExpect(jsonPath("$.sources[?(@.title == '" + WITH_STATUS + "')]").doesNotExist());
    }

    private void seed(String access) {
        var document = new Document();
        document.setId(UUID.randomUUID());
        document.setSlug("probe-" + access);
        document.setTitle(TITLE);
        document.setDocGroup("Система качества");
        document.setSubject("Производство");
        document.setSensitivity("public");
        document.setAccess(access);
        // listed = true обязателен: открытый контур ищет по перечню.
        // Ограничение V21 такую строку принимает — уровень public.
        document.setListed(true);
        document.setPublished(false);
        documents.saveAndFlush(document);
    }

    private static org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder ask(
            String question) {
        return post("/api/assistant/v1/ask")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"question\":\"" + question + "\"}");
    }
}
