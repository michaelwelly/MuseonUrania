package ru.vedal.portal.notifications;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;

@Configuration
public class MailSenderConfig {

    private static final Logger log = LoggerFactory.getLogger(MailSenderConfig.class);

    // Отправитель выбирается здесь обычным if, а не двумя бинами с @Conditional.
    // Порядок, в котором Spring разбирает условия в пользовательской
    // конфигурации, не гарантирован — с двумя бинами «какой из них победит»
    // стало бы вопросом везения, а цена ошибки здесь в том, что письма молча
    // не уходят.
    //
    // Признак настроенного SMTP — наличие бина JavaMailSender. Его заводит
    // автоконфигурация Spring Boot и ровно тогда, когда задан spring.mail.host.
    // Отдельного собственного флага «включить почту» нет намеренно: два
    // переключателя одного и того же рано или поздно разъезжаются.
    // Пустой адрес проверяется отдельно от наличия бина. Условие
    // автоконфигурации — «свойство задано», и пустая строка ему удовлетворяет:
    // в Compose переменная, объявленная без значения, приезжает в контейнер
    // именно пустой строкой. Без этой проверки портал счёл бы почту
    // настроенной и ронял бы каждое письмо на пустом адресе сервера.
    @Bean
    @ConditionalOnMissingBean(MailSender.class)
    MailSender mailSender(ObjectProvider<JavaMailSender> transport,
                          @Value("${spring.mail.host:}") String host,
                          @Value("${vedal.notifications.from:}") String from,
                          @Value("${spring.mail.username:}") String username) {
        var javaMail = transport.getIfAvailable();
        if (javaMail == null || host.isBlank()) {
            // Предупреждение, а не отказ подняться. Портал без почты принимает
            // заявки и показывает их в админке — это рабочее состояние машины
            // разработчика и стенда. Но проговорить последствие обязательно:
            // письма помечаются отправленными, хотя наружу не уходит ничего.
            log.warn("SMTP не настроен (нет spring.mail.host). Письма будут помечаться"
                    + " отправленными, но наружу не уйдут. Для отправки задайте"
                    + " SPRING_MAIL_HOST, SPRING_MAIL_USERNAME и SPRING_MAIL_PASSWORD.");
            return loggingMailSender();
        }

        var envelopeFrom = from.isBlank() ? username : from;
        if (envelopeFrom.isBlank()) {
            // Пустой обратный адрес Яндекс 360 отвергнет на каждом письме.
            // Поймать это на старте дешевле, чем на первой заявке.
            throw new IllegalStateException("SMTP настроен, но обратный адрес пуст:"
                    + " задайте vedal.notifications.from или spring.mail.username");
        }
        log.info("почта: SMTP, обратный адрес {}", envelopeFrom);
        return new SmtpMailSender(javaMail, envelopeFrom);
    }

    // Запасной отправитель: письмо уходит в лог. Адрес пишем, тело — нет:
    // в письме клиенту стоит номер обращения, и лог не должен становиться
    // ещё одним местом хранения переписки.
    private static MailSender loggingMailSender() {
        return (to, subject, body) -> log.info("письмо на {} тема «{}» ({} символов) —"
                + " наружу НЕ отправлено, SMTP не настроен", to, subject, body.length());
    }
}
