package ru.vedal.portal.notifications;

// Порт наружу. Ранняя реализация — запись в лог, полная — SMTP Яндекс 360.
public interface MailSender {

    void send(String to, String subject, String body);
}
