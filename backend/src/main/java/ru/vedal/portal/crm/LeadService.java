package ru.vedal.portal.crm;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.audit.AuditLog;
import ru.vedal.portal.common.CorrelationId;
import ru.vedal.portal.common.DomainEvents;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
public class LeadService implements LeadIntake {

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
                return new Receipt(existing.get().getId(), false);
            }
        }

        var lead = new Lead();
        lead.setId(UUID.randomUUID());
        lead.setForm(draft.form());
        lead.setName(draft.name());
        lead.setCompany(blankToNull(draft.company()));
        lead.setPhone(draft.phone());
        lead.setEmail(draft.email());
        lead.setProductSlug(blankToNull(draft.productSlug()));
        lead.setMessage(draft.message());
        lead.setConsentVersion(consentVersion);
        lead.setConsentAt(Instant.now());
        lead.setSource(draft.source());
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
            return new Receipt(winner.getId(), false);
        }

        // Событие и строка заявки коммитятся одним COMMIT: между INSERT и
        // отправкой не должно быть щели, в которую проваливается заявка.
        events.record("lead", lead.getId().toString(), "vedal.leads.v1",
                Map.of("form", lead.getForm(), "source", lead.getSource()));

        // В журнал — без персональных данных: только факт, форма и идентификатор.
        audit.record("public", "lead.accept", "lead", lead.getId().toString(),
                Map.of("form", lead.getForm(), "source", lead.getSource()));

        return new Receipt(lead.getId(), true);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
