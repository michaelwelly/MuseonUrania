package ru.vedal.portal.notifications;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import ru.vedal.portal.PostgresTestBase;

import static org.assertj.core.api.Assertions.assertThat;

// Приложение целиком с настроенным SMTP.
//
// Почему отдельный контекст, а не проверка в MailSenderChoiceTest. Тот поднимает
// одну конфигурацию через ApplicationContextRunner — быстро и точно, но
// автоконфигурации Spring Boot там нет. А ломалось именно её присутствие:
// при заданном spring.mail.host она заводит собственный бин с именем
// mailSender, и такое же имя у нашего означало два определения одного имени.
// Переопределение бинов выключено, поэтому портал не поднимался вовсе —
// и случилось бы это ровно в тот день, когда почту наконец настроят.
//
// Ни одного письма этот тест не отправляет: адрес заведомо несуществующий,
// а соединение JavaMail открывает только в момент отправки.
@TestPropertySource(properties = {
        "spring.mail.host=smtp.invalid.test",
        "spring.mail.username=portal@vedal-med.ru",
        "spring.mail.password=не-настоящий",
})
class MailSenderBootTest extends PostgresTestBase {

    @Autowired
    MailSender sender;

    @Test
    void portalStartsWithSmtpConfigured() {
        assertThat(sender)
                .as("при заданном spring.mail.host отправителем становится SMTP")
                .isInstanceOf(SmtpMailSender.class);
    }
}
