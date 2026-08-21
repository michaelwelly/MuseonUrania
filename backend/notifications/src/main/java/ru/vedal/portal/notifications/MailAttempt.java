package ru.vedal.portal.notifications;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

// Одна попытка отправки — одна транзакция.
//
// Отдельный бин, а не метод в MailDispatch, по той же причине, по которой
// отдельным бином вынесено расписание: вызов @Transactional-метода у себя же
// идёт мимо прокси, и транзакции просто не будет.
//
// Почему транзакция на письмо, а не на батч. Раньше drain() держал одну
// транзакцию на все пятьдесят писем и отправлял внутри неё. С записью в лог
// это ничего не стоило. С настоящим SMTP получалось два неприятных свойства:
// транзакция БД жила столько, сколько длились пятьдесят сетевых обменов,
// а откат в середине терял статусы уже отправленных писем — и следующий заход
// отправлял их повторно. Дубль подтверждения клиенту.
//
// Сетевой вызов при этом остаётся ВНУТРИ транзакции, а не выносится наружу:
// иначе между «письмо ушло» и «статус записан» появляется то же окно, только
// уже размером в одно письмо. Транзакция коротка потому, что её длительность
// ограничена таймаутами SMTP (application.properties), а не длиной очереди.
@Component
public class MailAttempt {

    private static final Logger log = LoggerFactory.getLogger(MailAttempt.class);

    // Ряд выдержек между попытками. Шагов столько же, сколько попыток
    // по умолчанию (vedal.notifications.max-attempts=5); последняя приходится
    // примерно через семь часов после первой.
    //
    // Ряд подобран под два разных сбоя: перезапуск почтового сервера — это
    // минуты, работы у провайдера — часы. Растягивать дальше нельзя: письмо
    // с подтверждением заявки, дошедшее через сутки, приходит уже после того,
    // как клиент позвонил сам.
    static final Duration[] BACKOFF = {
            Duration.ofMinutes(1),
            Duration.ofMinutes(5),
            Duration.ofMinutes(15),
            Duration.ofHours(1),
            Duration.ofHours(6),
    };

    // Причина отказа обрезается: текст приходит от чужого сервера, длину
    // ему никто не ограничивал, а колонка last_error переживает пять попыток
    // и остаётся в таблице навсегда.
    private static final int ERROR_LIMIT = 500;

    private final OutboundMailRepository mails;
    private final MailSender sender;
    private final int maxAttempts;

    public MailAttempt(OutboundMailRepository mails, MailSender sender,
                       @Value("${vedal.notifications.max-attempts:5}") int maxAttempts) {
        this.mails = mails;
        this.sender = sender;
        this.maxAttempts = maxAttempts;
    }

    @Transactional
    public void run(UUID id) {
        var mail = mails.findForAttempt(id).orElse(null);
        // Письмо могло уйти, пока мы ждали блокировку: за строку конкурировал
        // второй экземпляр портала. Отправлять второй раз нечего.
        if (mail == null || !OutboundMail.QUEUED.equals(mail.getStatus())) {
            return;
        }

        mail.setAttempts(mail.getAttempts() + 1);
        try {
            sender.send(mail.getToAddress(), mail.getSubject(), mail.getBody());
            mail.setStatus(OutboundMail.SENT);
            mail.setSentAt(Instant.now());
            mail.setLastError(null);
        } catch (MailPermanentFailure e) {
            giveUp(mail, e, "отказ окончательный");
        } catch (RuntimeException e) {
            // Сюда попадает и MailTransientFailure, и всё, чего мы не предвидели.
            // Неизвестное считаем временным намеренно: ошибочно повторённое
            // письмо дойдёт, ошибочно похороненное — нет.
            mail.setLastError(describe(e));
            if (mail.getAttempts() >= maxAttempts) {
                giveUp(mail, e, "попытки исчерпаны");
            } else {
                var wait = BACKOFF[Math.min(mail.getAttempts() - 1, BACKOFF.length - 1)];
                mail.setNextAttemptAt(Instant.now().plus(wait));
                log.info("письмо {}: попытка {} не удалась, следующая через {} ({})",
                        mail.getId(), mail.getAttempts(), wait, mail.getLastError());
            }
        }
        mails.save(mail);
    }

    private void giveUp(OutboundMail mail, RuntimeException e, String why) {
        mail.setLastError(describe(e));
        mail.setStatus(OutboundMail.FAILED);
        log.warn("письмо {} в разбор руками ({}), попыток {}: {}",
                mail.getId(), why, mail.getAttempts(), mail.getLastError());
    }

    // Тело письма в причину не попадает: в подтверждении клиенту стоит номер
    // обращения, и лог не должен становиться ещё одним местом хранения переписки.
    private static String describe(RuntimeException e) {
        var text = e.getClass().getSimpleName() + ": " + e.getMessage();
        return text.length() <= ERROR_LIMIT ? text : text.substring(0, ERROR_LIMIT) + "…";
    }
}
