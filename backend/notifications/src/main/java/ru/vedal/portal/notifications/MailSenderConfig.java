package ru.vedal.portal.notifications;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MailSenderConfig {

    private static final Logger log = LoggerFactory.getLogger(MailSenderConfig.class);

    // Пока SMTP не подключён, письмо уходит в лог. Адрес пишем, тело — нет:
    // в письме клиенту стоит номер обращения, и лог не должен становиться
    // ещё одним местом хранения переписки.
    @Bean
    @ConditionalOnMissingBean(MailSender.class)
    MailSender loggingMailSender() {
        return (to, subject, body) -> log.info("письмо на {} тема «{}» ({} символов)",
                to, subject, body.length());
    }
}
