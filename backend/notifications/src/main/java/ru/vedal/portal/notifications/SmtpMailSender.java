package ru.vedal.portal.notifications;

import jakarta.mail.SendFailedException;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailParseException;
import org.springframework.mail.MailPreparationException;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;

import java.nio.charset.StandardCharsets;

// Транспорт: корпоративная почта Яндекс 360. Реализация порта MailSender;
// выбор между ней и записью в лог — в MailSenderConfig.
//
// Отправитель ничего не решает про очередь: он либо отправил, либо бросил
// исключение одного из двух видов. Что делать дальше — повторить или отдать
// в разбор руками — решает MailAttempt.
public class SmtpMailSender implements MailSender {

    private final JavaMailSender transport;
    private final String from;

    // Обратный адрес отдельным параметром, а не «взять из настроек внутри».
    // Яндекс 360 принимает письмо только от того ящика, под которым выполнен
    // вход: расхождение between From и учётной записью даёт отказ 550,
    // и увидеть его лучше на старте, чем на первой заявке.
    public SmtpMailSender(JavaMailSender transport, String from) {
        this.transport = transport;
        this.from = from;
    }

    @Override
    public void send(String to, String subject, String body) {
        // Проверка до сборки письма. Адрес получателя приходит из формы
        // на сайте, то есть от постороннего; перевод строки в нём — это
        // попытка дописать свои заголовки (Bcc, Reply-To) в наше письмо.
        // Библиотека такие адреса и сама не пропустит, но отказ от неё
        // прилетит как MailParseException без внятной причины, а здесь
        // причина названа и письмо сразу помечено окончательно отказавшим.
        rejectControlCharacters(to, "адрес получателя");
        rejectControlCharacters(subject, "тема письма");

        try {
            var message = transport.createMimeMessage();
            var helper = new MimeMessageHelper(message, false, StandardCharsets.UTF_8.name());
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject(subject);
            // false — текст, а не HTML. Наружу из этого модуля уходит только
            // шаблонное письмо; разметка ему не нужна, а вместе с ней
            // не нужен и разбор чужого HTML на стороне получателя.
            helper.setText(body, false);
            transport.send(message);
        } catch (MailSendException e) {
            // Сервер отверг сам адрес — повторять нечего.
            if (addressWasRejected(e)) {
                throw new MailPermanentFailure("адрес отвергнут сервером: " + e.getMessage(), e);
            }
            // Всё остальное — соединение, таймаут, временный отказ.
            throw new MailTransientFailure("SMTP не принял письмо: " + e.getMessage(), e);
        } catch (MailAuthenticationException e) {
            // Не отказ письму, а неверная настройка. Письмо не виновато
            // и должно дождаться, пока учётные данные поправят, — поэтому
            // временный отказ, а не окончательный.
            throw new MailTransientFailure("SMTP не принял учётные данные: " + e.getMessage(), e);
        } catch (MailParseException | MailPreparationException e) {
            // Письмо не собралось. Следующая попытка соберёт его точно так же.
            throw new MailPermanentFailure("письмо не собралось: " + e.getMessage(), e);
        } catch (jakarta.mail.MessagingException e) {
            throw new MailPermanentFailure("письмо не собралось: " + e.getMessage(), e);
        }
    }

    // Признак отказа именно по адресу берём из стандартного API Jakarta Mail,
    // а не из классов реализации (org.eclipse.angus.mail.smtp.*): у последних
    // код ответа доступен напрямую, но привязываться к имени пакета конкретной
    // реализации ради этого не стоит — она меняется вместе с версией Boot.
    private static boolean addressWasRejected(MailSendException e) {
        for (var failure : e.getFailedMessages().values()) {
            for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
                if (cause instanceof SendFailedException failed) {
                    var invalid = failed.getInvalidAddresses();
                    if (invalid != null && invalid.length > 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private static void rejectControlCharacters(String value, String what) {
        if (value == null) {
            throw new MailPermanentFailure(what + " не заполнен");
        }
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c == '\r' || c == '\n' || c == '\0') {
                throw new MailPermanentFailure(what + " содержит управляющий символ");
            }
        }
    }
}
