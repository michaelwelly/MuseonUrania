package ru.vedal.portal.chat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.vedal.portal.PostgresTestBase;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// `GET /chat/{visitorKey}` (чтение ленты) и `POST /chat/{visitorKey}/typing`
// (пинг «печатает») были заведены без всякого лимита частоты — issue #65
// назвал это дверью без счётчика. Теперь у каждой свой бюджет — общий
// с `ask`/`say` (20 за 10 минут) обрывал бы «печатает» на середине обычного
// набора текста, см. ChatConfig.
//
// Пределы понижены настройкой теста: дожидаться настоящих 60 и 240 запросов
// ради теста накладно, а сам механизм RateLimit проверен RateLimitTest.
// Здесь проверяется то, что не проверяет он, — что каждая дверь вообще
// спрашивает лимит, и спрашивает свой, а не чужой.
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "vedal.chat.read-rate-limit.count=2",
        "vedal.chat.typing-rate-limit.count=2"})
class ChatActivityRateLimitTest extends PostgresTestBase {

    @Autowired
    MockMvc mvc;

    @Test
    void readingTheThreadHasItsOwnBudget() throws Exception {
        var адрес = свой();
        var key = UUID.randomUUID().toString();

        mvc.perform(get("/api/assistant/v1/chat/{key}", key).with(адрес)).andExpect(status().isOk());
        mvc.perform(get("/api/assistant/v1/chat/{key}", key).with(адрес)).andExpect(status().isOk());

        mvc.perform(get("/api/assistant/v1/chat/{key}", key).with(адрес))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void pingingTypingHasItsOwnWiderBudget() throws Exception {
        var адрес = свой();
        var key = UUID.randomUUID().toString();

        mvc.perform(post("/api/assistant/v1/chat/{key}/typing", key).with(адрес))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/assistant/v1/chat/{key}/typing", key).with(адрес))
                .andExpect(status().isNoContent());

        mvc.perform(post("/api/assistant/v1/chat/{key}/typing", key).with(адрес))
                .andExpect(status().isTooManyRequests());
    }

    // Оба предела считаются раздельно: пинг «печатает» с тем же адресом
    // не должен упереться в лимит чтения и наоборот — у каждой двери свой
    // бюджет, потому что у них разная законная частота использования.
    @Test
    void readingAndTypingDoNotShareABudget() throws Exception {
        var адрес = свой();
        var key = UUID.randomUUID().toString();

        mvc.perform(get("/api/assistant/v1/chat/{key}", key).with(адрес)).andExpect(status().isOk());
        mvc.perform(get("/api/assistant/v1/chat/{key}", key).with(адрес)).andExpect(status().isOk());
        mvc.perform(get("/api/assistant/v1/chat/{key}", key).with(адрес))
                .andExpect(status().isTooManyRequests());

        // Лимит чтения исчерпан, а печатание — отдельный счётчик, и оно
        // по-прежнему проходит.
        mvc.perform(post("/api/assistant/v1/chat/{key}/typing", key).with(адрес))
                .andExpect(status().isNoContent());
    }

    /** Свой адрес клиента на тест — счётчик живёт в памяти процесса и не сбрасывается транзакцией. */
    private static RequestPostProcessor свой() {
        var адрес = "10." + (int) (Math.random() * 250)
                + "." + (int) (Math.random() * 250) + "." + (1 + (int) (Math.random() * 250));
        return request -> {
            request.setRemoteAddr(адрес);
            return request;
        };
    }
}
