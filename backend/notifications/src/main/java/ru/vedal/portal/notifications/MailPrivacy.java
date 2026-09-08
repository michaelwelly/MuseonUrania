package ru.vedal.portal.notifications;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.audit.AuditLog;
import ru.vedal.portal.common.NotFoundException;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

// Уничтожение персональных данных в исходящих письмах.
//
// ————— что здесь персональные данные —————
//
// Адрес получателя — сам по себе персональные данные, и часто единственные,
// которые вообще уходят наружу из портала конкретному человеку: письмо
// клиенту адресовано на его личную почту. Тема и тело сегодня не содержат
// имени и телефона (см. MailTemplate — бриф собственника прямо запрещает
// свободный текст с контактами в письме менеджеру), но правило пишется не
// под сегодняшний шаблон: новый шаблон, который однажды подставит в текст
// имя из контекста, не должен требовать правки этого класса.
//
// ————— чего здесь нет —————
//
// Письмо не удаляется строкой: template, status, attempts, correlation_id
// и время нужны разбору доставки так же, как заявке — разбору воронки.
// Удалить строку значило бы стереть и то, что доставку вообще пытались
// сделать.
//
// Письма в очереди (status = 'queued') не трогаются: адрес получателя нужен
// самой попытке отправки, а обезличивание письма, которое вот-вот уйдёт,
// отправило бы «удалено» вместо настоящего адреса. Через годы срока
// хранения такое почти не случится, но метод не должен полагаться на то,
// что вызовут его только автоочистка с большим сроком.
@Service
public class MailPrivacy {

    /** Та же метка, что у карточек CRM и переписки: единый язык для «стёрто по закону». */
    public static final String ERASED = "удалено";

    private final OutboundMailRepository mails;
    private final AuditLog audit;

    public MailPrivacy(OutboundMailRepository mails, AuditLog audit) {
        this.mails = mails;
        this.audit = audit;
    }

    /**
     * Уничтожить персональные данные письма.
     *
     * @return {@code false}, если они уже были уничтожены раньше, или письмо
     *         ещё в очереди на отправку.
     */
    @Transactional
    public boolean erase(UUID id, String basis, String actor) {
        var mail = mails.findById(id).orElseThrow(() -> new NotFoundException("Письмо не найдено"));
        return erase(mail, basis, actor);
    }

    /**
     * Уничтожить данные писем, отправленных по заявке.
     *
     * <p>Обращение человек подаёт одно, а его данные лежат в нескольких
     * местах: в заявке, в переписке, которая её породила, и в письме, которым
     * заявку подтвердили. Стереть заявку и оставить подтверждение — значит
     * исполнить обращение наполовину.
     *
     * @return сколько писем обезличено этим вызовом.
     */
    @Transactional
    public int eraseByLead(UUID leadId, String basis, String actor) {
        var found = mails.findByLeadId(leadId);
        var erased = 0;
        for (var mail : found) {
            if (erase(mail, basis, actor)) erased++;
        }
        return erased;
    }

    private boolean erase(OutboundMail mail, String basis, String actor) {
        if (mail.getErasedAt() != null) return false;
        if (OutboundMail.QUEUED.equals(mail.getStatus())) return false;

        mail.setToAddress(ERASED);
        mail.setSubject(ERASED);
        mail.setBody(ERASED);

        mail.setErasedAt(Instant.now());
        mail.setErasureBasis(basis);

        audit.record(actor, "mail.erased", "outbound_mail", mail.getId().toString(),
                Map.of("basis", basis));
        return true;
    }
}
