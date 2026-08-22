package ru.vedal.portal.notifications;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Приложение целиком с настроенным SMTP.
//
// Почему отдельный контекст, а не проверка в MailSenderChoiceTest. Тот поднимает
// одну конфигурацию через ApplicationContextRunner — быстро и точно, но
// автоконфигураций Spring Boot там нет. А ломалось именно их присутствие:
// при заданном spring.mail.host автоконфигурация заводит собственный бин
// с именем mailSender, и такое же имя у нашего означало два определения одного
// имени. Переопределение бинов выключено, поэтому портал не поднимался вовсе —
// и случилось бы это ровно в тот день, когда почту наконец настроят.
//
// Ни одного письма этот тест не отправляет: адрес заведомо несуществующий,
// а соединение JavaMail открывает только в момент отправки.
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.mail.host=smtp.invalid.test",
        "spring.mail.username=portal@vedal-med.ru",
        "spring.mail.password=не-настоящий",
})
class MailSenderBootTest extends PostgresTestBase {

    @Autowired
    MailSender sender;

    @Autowired
    MockMvc mvc;

    @Test
    void portalStartsWithSmtpConfigured() {
        assertThat(sender)
                .as("при заданном spring.mail.host отправителем становится SMTP")
                .isInstanceOf(SmtpMailSender.class);
    }

    // Недоступный SMTP не должен снимать портал с обслуживания.
    //
    // Проверка не про настройку, а про поведение под сбоем: письма уходят
    // асинхронно, через очередь с выдержкой, и недоступный почтовый сервер
    // означает «письмо подождёт час», а не «портал сломан». Со включённым
    // индикатором почты общий /actuator/health отдавал DOWN, а его и опрашивает
    // healthcheck контейнера — получасовые работы у почтового провайдера
    // снимали бы заодно и сайт, и приём заявок.
    @Test
    void unreachableSmtpDoesNotMakeThePortalUnhealthy() throws Exception {
        // Ровно то, что проверяет docker: код ответа. При DOWN actuator
        // отвечает 503, и `curl -fsS` из healthcheck считает портал больным.
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }
}
