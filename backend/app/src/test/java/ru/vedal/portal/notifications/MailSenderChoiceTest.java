package ru.vedal.portal.notifications;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import static org.assertj.core.api.Assertions.assertThat;

// Выбор отправителя на старте. Без контекста приложения целиком: проверяется
// одно решение, и поднимать ради него базу незачем.
class MailSenderChoiceTest {

    private final ApplicationContextRunner context = new ApplicationContextRunner()
            .withUserConfiguration(MailSenderConfig.class);

    @Test
    void withoutTransportMailGoesToTheLog() {
        context.run(ctx -> assertThat(ctx.getBean(MailSender.class))
                .isNotInstanceOf(SmtpMailSender.class));
    }

    // Главная ловушка. В Compose переменная, объявленная без значения,
    // приезжает в контейнер пустой строкой, а условие автоконфигурации —
    // «свойство задано»: пустая строка ему удовлетворяет, и бин транспорта
    // создаётся. Портал в этом месте обязан увидеть, что адреса нет,
    // и не пытаться отправлять — иначе каждое письмо падает на пустом хосте.
    @Test
    void blankHostIsNotAConfiguredSmtp() {
        context.withBean(JavaMailSender.class, JavaMailSenderImpl::new)
                .withPropertyValues("spring.mail.host=", "spring.mail.username=portal@vedal-med.ru")
                .run(ctx -> assertThat(ctx.getBean(MailSender.class))
                        .isNotInstanceOf(SmtpMailSender.class));
    }

    @Test
    void configuredHostGivesSmtp() {
        context.withBean(JavaMailSender.class, JavaMailSenderImpl::new)
                .withPropertyValues("spring.mail.host=smtp.yandex.ru",
                        "spring.mail.username=portal@vedal-med.ru")
                .run(ctx -> assertThat(ctx.getBean(MailSender.class))
                        .isInstanceOf(SmtpMailSender.class));
    }

    // Обратный адрес пуст — Яндекс 360 отверг бы каждое письмо. Отказ на старте
    // виден сразу, отказ на первой заявке — через день и уже с потерянным
    // подтверждением.
    @Test
    void configuredSmtpWithoutSenderAddressFailsAtStartup() {
        context.withBean(JavaMailSender.class, JavaMailSenderImpl::new)
                .withPropertyValues("spring.mail.host=smtp.yandex.ru")
                .run(ctx -> assertThat(ctx).hasFailed());
    }
}
