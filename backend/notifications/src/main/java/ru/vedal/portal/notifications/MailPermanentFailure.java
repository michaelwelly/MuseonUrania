package ru.vedal.portal.notifications;

// Отказ, повторять который бессмысленно: такого ящика не существует, адрес
// отвергнут сервером (коды 5xx), в адресе или теме управляющие символы.
// Письмо сразу уходит в разбор руками — в 'failed', минуя оставшиеся попытки.
//
// Почему не ждать исчерпания попыток. Опечатка в адресе не рассосётся за шесть
// часов, а до разбора руками письмо доживёт только тем, что займёт очередь
// и размажет причину по пяти одинаковым записям в last_error.
public class MailPermanentFailure extends RuntimeException {

    public MailPermanentFailure(String message) {
        super(message);
    }

    public MailPermanentFailure(String message, Throwable cause) {
        super(message, cause);
    }
}
