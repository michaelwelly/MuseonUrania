package ru.vedal.portal.crm;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.audit.AuditLog;
import ru.vedal.portal.common.NotFoundException;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

// Уничтожение персональных данных: по обращению человека и по истечении срока.
//
// ————— обезличивание, а не удаление строки —————
//
// Удалить строку заявки нельзя, не сломав три вещи сразу: сделка ссылается
// на заявку, аналитика считает по ней воронку, журнал хранит её идентификатор.
// Обезличивание закрывает требование и не ломает ничего — после него строка
// не позволяет опознать человека, то есть перестаёт быть персональными данными.
//
// ————— идемпотентность —————
//
// Повторное обращение — обычное дело: человек написал дважды, сотрудник нажал
// дважды, автоочистка догнала уже обезличенное. Второй вызов ничего не меняет
// и не считается ошибкой, но и не пишет вторую запись в журнал: журнал
// с десятью «удалено» на одну заявку не помогает разобраться, а мешает.
//
// ————— чего здесь нет —————
//
// Записи журнала не трогаются. Он неизменяем, и это не противоречие: проверено
// по коду, что в журнал по заявке уходят только форма и источник, а тела
// сообщений и контакты — нет. Будь иначе, пришлось бы выбирать между двумя
// требованиями, и выбор был бы плохим в любую сторону.
@Service
public class PersonalData {

    // Читаемая метка, а не пустая строка: колонки объявлены NOT NULL, а
    // сотрудник, открывший карточку, должен понимать, что данных нет по
    // закону, а не потерялись при сбое.
    public static final String ERASED = "удалено";

    /** Почему уничтожили. Основание хранится рядом с отметкой времени. */
    public enum Basis {
        /** Обращение субъекта персональных данных. */
        REQUEST("обращение субъекта"),
        /** Истёк срок хранения. */
        RETENTION("истёк срок хранения");

        private final String text;

        Basis(String text) {
            this.text = text;
        }

        public String text() {
            return text;
        }
    }

    private final LeadRepository leads;
    private final ClientRepository clients;
    private final InteractionRepository interactions;
    private final AuditLog audit;

    public PersonalData(LeadRepository leads, ClientRepository clients,
                        InteractionRepository interactions, AuditLog audit) {
        this.leads = leads;
        this.clients = clients;
        this.interactions = interactions;
        this.audit = audit;
    }

    /**
     * Уничтожить персональные данные заявки.
     *
     * @return {@code false}, если они уже были уничтожены раньше.
     */
    @Transactional
    public boolean eraseLead(UUID id, Basis basis, String actor) {
        var lead = leads.findById(id).orElseThrow(() -> new NotFoundException("Заявка не найдена"));
        if (lead.getErasedAt() != null) return false;

        lead.setName(ERASED);
        lead.setPhone(ERASED);
        lead.setEmail(ERASED);
        // Текст обращения человек пишет сам и волен указать там что угодно —
        // включая себя, своих коллег и пациента. Это персональные данные
        // в той же мере, что и поле «телефон».
        lead.setMessage(ERASED);

        // Организация не трогается: юридическое лицо персональными данными
        // не является, а без неё аналитика по клиентам теряет смысл.

        eraseInteractions(interactions.findByLeadIdOrderByAtDesc(id));
        mark(lead::setErasedAt, lead::setErasureBasis, basis);

        audit.record(actor, "lead.erased", "lead", id.toString(),
                Map.of("basis", basis.name().toLowerCase()));
        return true;
    }

    /**
     * Уничтожить персональные данные карточки клиента.
     *
     * <p>Наименование стирается только у частного лица. У организации это её
     * название — не персональные данные, и стерев его мы получили бы сделки,
     * подписанные словом «удалено».
     */
    @Transactional
    public boolean eraseClient(UUID id, Basis basis, String actor) {
        var client = clients.findById(id)
                .orElseThrow(() -> new NotFoundException("Клиент не найден"));
        if (client.getErasedAt() != null) return false;

        client.setEmail(ERASED);
        client.setPhone(ERASED);
        client.setNote(ERASED);
        if ("person".equals(client.getKind())) client.setName(ERASED);

        eraseInteractions(interactions.findByClientIdOrderByAtDesc(id));
        mark(client::setErasedAt, client::setErasureBasis, basis);

        audit.record(actor, "client.erased", "client", id.toString(),
                Map.of("basis", basis.name().toLowerCase()));
        return true;
    }

    // История переписки — такой же носитель персональных данных, как поля
    // карточки, и часто более полный: там переписка целиком. Оставить её
    // значит не выполнить обращение, а сделать вид.
    private void eraseInteractions(Iterable<Interaction> records) {
        for (var record : records) {
            if (record.getSubject() != null) record.setSubject(ERASED);
            record.setBody(ERASED);
        }
    }

    private void mark(java.util.function.Consumer<Instant> at,
                      java.util.function.Consumer<String> why, Basis basis) {
        at.accept(Instant.now());
        why.accept(basis.text());
    }
}
