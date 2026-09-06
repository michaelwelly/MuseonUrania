package ru.vedal.portal.crm;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.audit.AuditLog;
import ru.vedal.portal.common.CorrelationId;
import ru.vedal.portal.common.DomainEvents;
import ru.vedal.portal.common.KafkaTopics;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class LeadService implements LeadIntake, LeadContacts {

    private final LeadRepository leads;
    private final DomainEvents events;
    private final AuditLog audit;
    private final String consentVersion;

    public LeadService(LeadRepository leads, DomainEvents events, AuditLog audit,
                       @Value("${vedal.consent.version}") String consentVersion) {
        this.leads = leads;
        this.events = events;
        this.audit = audit;
        this.consentVersion = consentVersion;
    }

    @Override
    @Transactional
    public Receipt accept(Draft draft, String idempotencyKey) {
        if (idempotencyKey != null) {
            var existing = leads.findByIdempotencyKey(idempotencyKey);
            if (existing.isPresent()) {
                return new Receipt(existing.get().getId(), existing.get().getNumber(), false);
            }
        }

        var lead = new Lead();
        lead.setId(UUID.randomUUID());
        lead.setNumber(nextNumber());
        lead.setForm(draft.form());
        lead.setName(draft.name());
        lead.setCompany(blankToNull(draft.company()));
        lead.setPhone(draft.phone());
        lead.setEmail(draft.email());
        lead.setProductSlug(blankToNull(draft.productSlug()));
        // Пустое поле формы — это «номер не указан», а не строка нулевой
        // длины: иначе поиск по номеру находил бы каждую заявку без номера.
        lead.setSerialNumber(blankToNull(draft.serialNumber()));
        lead.setMessage(draft.message());
        lead.setConsentVersion(consentVersion);
        lead.setConsentAt(Instant.now());
        lead.setSource(draft.source());
        // Язык приводим к нижнему регистру: `RU` с одной страницы и `ru`
        // с другой развалили бы разрез по языку на две строки.
        lead.setLanguage(lower(blankToNull(draft.language())));
        lead.setCampaign(blankToNull(draft.campaign()));
        // Черновик, а не готовый лид: доступа к закрытым данным у него нет,
        // менеджер поднимает статус вручную.
        lead.setStatus("draft");
        lead.setCorrelationId(CorrelationId.current());
        lead.setIdempotencyKey(idempotencyKey);

        try {
            leads.saveAndFlush(lead);
        } catch (DataIntegrityViolationException e) {
            // Две одновременные отправки с одним ключом: проверку выше прошли обе,
            // вставку — одна. Отдаём ту заявку, которая уже есть.
            var winner = idempotencyKey == null ? null : leads.findByIdempotencyKey(idempotencyKey).orElse(null);
            if (winner == null) throw e;
            return new Receipt(winner.getId(), winner.getNumber(), false);
        }

        // Событие и строка заявки коммитятся одним COMMIT: между INSERT и
        // отправкой не должно быть щели, в которую проваливается заявка.
        events.record("lead", lead.getId().toString(), KafkaTopics.LEADS,
                Map.of("form", lead.getForm(), "source", lead.getSource()));

        // В журнал — без персональных данных: только факт, форма и идентификатор.
        audit.record("public", "lead.accept", "lead", lead.getId().toString(),
                Map.of("form", lead.getForm(), "source", lead.getSource()));

        return new Receipt(lead.getId(), lead.getNumber(), true);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Contact> contact(UUID leadId) {
        return leads.findById(leadId)
                .map(l -> new Contact(l.getId(), l.getNumber(), l.getEmail(),
                        l.getForm(), l.getProductSlug()));
    }

    /**
     * Номер, который называют вслух: «З-2026-0042».
     *
     * <p>Собирается здесь, а не в базе: номер — это то, что видит человек,
     * и три экрана, собирающие его по-своему, дадут три вида одного номера.
     *
     * <p>Год не сбрасывает нумерацию — последовательность сквозная. Сброс
     * означал бы, что в январе номера начинают повторяться: «З-2025-0007»
     * и «З-2026-0007» звучат одинаково ровно в том разговоре, где номер
     * и произносят.
     */
    private String nextNumber() {
        return "З-" + LocalDate.now(ZoneOffset.UTC).getYear() + "-"
                + String.format("%04d", leads.nextNumber());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static String lower(String value) {
        return value == null ? null : value.toLowerCase(java.util.Locale.ROOT);
    }
}
