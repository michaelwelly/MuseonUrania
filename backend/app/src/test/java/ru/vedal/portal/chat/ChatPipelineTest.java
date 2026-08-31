package ru.vedal.portal.chat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.PostgresTestBase;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Весь путь одного вопроса: дверь — приём — ответ, доехавший сам.
 *
 * <p><b>Зачем отдельно от остальных тестов чата.</b> Те идут в транзакции,
 * которая откатывается, и до COMMIT в них дело не доходит никогда — а ответ
 * запускает слушатель, который ждёт именно COMMIT. То есть самое главное
 * в новом устройстве разговора остальные тесты проверить не могут в принципе:
 * они зовут шаг ответа руками.
 *
 * <p>Здесь транзакции нет: {@code NOT_SUPPORTED} отменяет ту, что объявлена
 * базовым классом. Запись остаётся в базе после теста, и это осознанно —
 * разговоры не сидируются и ничьих подсчётов не сбивают. Иначе проверять
 * было бы нечего: откат означает, что события не будет.
 */
@AutoConfigureMockMvc
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class ChatPipelineTest extends PostgresTestBase {

    // Десять секунд: столько же, сколько отводится на ответ модели. Меньше —
    // и тест начнёт мигать на медленной машине, а мигающий тест перестают
    // читать.
    private static final Duration PATIENCE = Duration.ofSeconds(10);

    @Autowired
    MockMvc mvc;

    @Autowired
    ChatDesk desk;

    @Test
    void theAnswerArrivesOnItsOwnAfterTheDoorHasAlreadyReplied() throws Exception {
        var key = UUID.randomUUID().toString();

        // Дверь отвечает сразу и без ответа Ведалины: с моделью ждать его
        // внутри запроса значит держать поток обслуживания и упираться
        // в сроки ожидания Caddy.
        mvc.perform(post("/api/assistant/v1/chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"visitorKey":"%s","text":"Что такое VEDAL A-2000?"}
                                """.formatted(key)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messages.length()").value(1))
                .andExpect(jsonPath("$.messages[0].author").value(ChatMessage.VISITOR));

        // А вот теперь ответ обязан доехать сам — без второго запроса от
        // посетителя и без чьей-либо помощи.
        var answered = waitForAnswer(key);

        assertThat(answered.messages())
                .as("Ответ Ведалины обязан доехать сам, иначе посетитель ждёт вечно")
                .hasSize(2);
        assertThat(answered.messages().getLast().author()).isEqualTo(ChatMessage.ASSISTANT);
        assertThat(answered.messages().getLast().sources())
                .as("Ответ без источников — ответ, которому нельзя верить")
                .isNotEmpty();
        assertThat(answered.answering())
                .as("Ответ записан — раздумье кончилось, точки в окне обязаны погаснуть")
                .isFalse();
    }

    // Вопрос, на который ответа нет, — тот же путь и тот же срок: разговор
    // встаёт в очередь сам, а не после того, как посетитель ещё раз напишет.
    @Test
    void aQuestionWithoutAnAnswerReachesTheQueueOnItsOwn() throws Exception {
        var key = UUID.randomUUID().toString();

        mvc.perform(post("/api/assistant/v1/chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"visitorKey":"%s","text":"Сколько стоит инкубатор?"}
                                """.formatted(key)))
                .andExpect(status().isOk());

        var answered = waitForAnswer(key);

        assertThat(answered.status()).isEqualTo(Conversation.WAITING);

        // И дверь чтения ленты рассказывает то же самое.
        mvc.perform(get("/api/assistant/v1/chat/{key}", key))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(Conversation.WAITING));
    }

    /** Ждать, пока Ведалина ответит, — как это делает виджет, только опросом. */
    private ChatDesk.Thread waitForAnswer(String key) throws InterruptedException {
        var deadline = Instant.now().plus(PATIENCE);
        while (Instant.now().isBefore(deadline)) {
            var thread = desk.threadFor(key);
            if (thread.messages().size() > 1) return thread;
            Thread.sleep(100);
        }
        throw new AssertionError(
                "Ведалина не ответила за " + PATIENCE.toSeconds() + " с — посетитель ждёт вечно");
    }
}
