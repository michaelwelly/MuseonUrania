package ru.vedal.portal.gateway;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.vedal.portal.chat.ChatDesk;
import ru.vedal.portal.chat.ChatMessage;
import ru.vedal.portal.chat.Conversation;
import ru.vedal.portal.crm.LeadRepository;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Разговор, доросший до обращения.
 *
 * <p>Дверь стоит в формах, а не в чате, и это главное, что здесь проверяется
 * не текстом, а устройством: заявка — запись снаружи, и принимает её то место,
 * где стоит периметр. Заодно здесь сшиваются `chat` и `crm`, которые друг
 * о друге не знают.
 */
@AutoConfigureMockMvc
class ChatLeadApiTest extends ru.vedal.portal.chat.ChatTestBase {

    /** Свой адрес: лимит частоты у форм общий, и делить его с соседями незачем. */
    private final String адрес = "10." + (int) (Math.random() * 250)
            + "." + (int) (Math.random() * 250) + "." + (1 + (int) (Math.random() * 250));

    @Autowired
    MockMvc mvc;

    @Autowired
    LeadRepository leads;

    @Test
    void raisesALeadFromTheConversationAndTellsTheNumber() throws Exception {
        var key = visitor();
        sayAndAnswer(key, "Что такое VEDAL A-2000?");

        mvc.perform(raise(key))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.number").value(org.hamcrest.Matchers.startsWith("З-")));

        var lead = leads.findAll().stream()
                .filter(l -> "chat".equals(l.getSource()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Заявка из разговора не завелась"));

        assertThat(lead.getForm())
                .as("Обращение из разговора — консультация: тип формы в чате не выбирают")
                .isEqualTo("consultation");

        // Переписка в теле заявки обязательна. Без неё менеджер видит
        // «перезвоните» и не видит вопроса, ради которого человек пришёл.
        assertThat(lead.getMessage())
                .contains("Посетитель: Что такое VEDAL A-2000?")
                .contains("Ведалина:");

        assertThat(lead.getConsentVersion())
                .as("Согласие хранится версией текста, а не галочкой")
                .isNotBlank();
    }

    // Номер — единственное, что посетитель уносит с собой. Он обязан быть
    // и в ленте: письмо можно не открыть, а окно чата человек уже видит.
    @Test
    void theNumberShowsUpInTheThreadItself() throws Exception {
        var key = visitor();
        sayAndAnswer(key, "Что такое VEDAL A-2000?");

        mvc.perform(raise(key)).andExpect(status().isAccepted());

        var thread = desk.threadFor(key);
        assertThat(thread.leadNumber()).isNotBlank();
        assertThat(thread.messages().getLast().author()).isEqualTo(ChatMessage.ASSISTANT);
        assertThat(thread.messages().getLast().body())
                .contains("Обращение принято")
                .contains(thread.leadNumber());
    }

    // Заявка — результат разговора, а не его конец. Человек, оставивший
    // контакты, волен спросить дальше, и отвечать ему будут здесь же.
    @Test
    void raisingALeadDoesNotEndTheConversation() throws Exception {
        var key = visitor();
        sayAndAnswer(key, "Что такое VEDAL A-2000?");

        mvc.perform(raise(key)).andExpect(status().isAccepted());

        assertThat(desk.threadFor(key).status()).isEqualTo(Conversation.OPEN);
    }

    // Второе нажатие кнопки — не второе обращение. Ключом повтора служит
    // сам разговор, и номер обязан вернуться тот же.
    @Test
    void pressingTwiceRaisesOneLeadWithOneNumber() throws Exception {
        var key = visitor();
        sayAndAnswer(key, "Что такое VEDAL A-2000?");

        var first = number(mvc.perform(raise(key)).andReturn().getResponse().getContentAsString());
        var second = number(mvc.perform(raise(key)).andReturn().getResponse().getContentAsString());

        assertThat(second).isEqualTo(first);
        assertThat(leads.findAll().stream().filter(l -> "chat".equals(l.getSource())).count())
                .isEqualTo(1);

        // И в ленте сообщение о нём одно: второе выглядело бы как второе
        // обращение.
        var about = desk.threadFor(key).messages().stream()
                .filter(m -> m.body().contains("Обращение принято"))
                .count();
        assertThat(about).isEqualTo(1);
    }

    // Разговора нет — обращение заводить не из чего. Приняв его, мы получили бы
    // заявку без переписки, то есть без вопроса.
    @Test
    void withoutAConversationTheSubmissionIsRefused() throws Exception {
        mvc.perform(raise(UUID.randomUUID().toString()))
                .andExpect(status().isBadRequest());
    }

    // Без согласия заявка не принимается — то же правило, что у формы на сайте.
    @Test
    void withoutConsentNothingIsAccepted() throws Exception {
        var key = visitor();
        sayAndAnswer(key, "Что такое VEDAL A-2000?");

        mvc.perform(post("/api/forms/v1/leads/from-chat")
                        .with(свой(адрес))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"visitorKey":"%s","name":"Ирина Петрова",
                                 "phone":"+7 343 300-00-00","email":"i@example.ru",
                                 "consent":false}
                                """.formatted(key)))
                .andExpect(status().isBadRequest());
    }

    private org.springframework.test.web.servlet.RequestBuilder raise(String key) {
        return post("/api/forms/v1/leads/from-chat")
                .with(свой(адрес))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"visitorKey":"%s","name":"Ирина Петрова","company":"ОПЦ",
                         "phone":"+7 343 300-00-00","email":"i.petrova@example.ru",
                         "language":"ru","consent":true}
                        """.formatted(key));
    }

    private static String number(String body) {
        var at = body.indexOf("\"number\":\"");
        return body.substring(at + 10, body.indexOf('"', at + 10));
    }

    private static RequestPostProcessor свой(String адрес) {
        return request -> {
            request.setRemoteAddr(адрес);
            return request;
        };
    }
}
