package ru.vedal.portal.crm;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.audit.AuditLog;
import ru.vedal.portal.common.ConflictException;
import ru.vedal.portal.common.NotFoundException;
import ru.vedal.portal.common.PageView;

import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class LeadTriage implements LeadAdmin {

    // Верхняя граница страницы. Без неё ?size=1000000 превращает список
    // в выгрузку всей базы персональных данных одним запросом.
    private static final int MAX_PAGE_SIZE = 200;

    private final LeadRepository leads;
    private final DealRepository deals;
    private final AuditLog audit;

    public LeadTriage(LeadRepository leads, DealRepository deals, AuditLog audit) {
        this.leads = leads;
        this.deals = deals;
        this.audit = audit;
    }

    @Override
    @Transactional(readOnly = true)
    public PageView<LeadRow> leads(String status, int page, int size) {
        var pageable = PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, MAX_PAGE_SIZE));
        var found = status == null || status.isBlank()
                ? leads.findAllByOrderByCreatedAtDesc(pageable)
                : leads.findByStatusOrderByCreatedAtDesc(status, pageable);

        // Какие заявки уже разобраны — одним запросом на страницу. Спрашивать
        // по строке значит превратить список из пятидесяти заявок
        // в пятьдесят с лишним обращений в базу.
        var ids = found.getContent().stream().map(Lead::getId).toList();
        var byLead = ids.isEmpty() ? Map.<UUID, UUID>of() : deals.findByLeadIdIn(ids).stream()
                .collect(Collectors.toMap(Deal::getLeadId, Deal::getId));

        return PageView.of(found, l -> row(l, byLead.get(l.getId())));
    }

    @Override
    @Transactional(readOnly = true)
    public LeadView lead(UUID id) {
        return view(find(id));
    }

    @Override
    @Transactional
    public LeadView triage(UUID id, Triage triage, String actor) {
        if (!STATUSES.contains(triage.status())) {
            throw new ConflictException("Неизвестный статус: " + triage.status()
                    + ". Допустимые: " + String.join(", ", STATUSES));
        }

        var lead = find(id);
        var wasStatus = lead.getStatus();
        lead.setStatus(triage.status());
        lead.setOwner(triage.owner() == null || triage.owner().isBlank() ? null : triage.owner());
        leads.save(lead);

        // Персональных данных в журнале нет — только идентификатор заявки
        // и что с ней сделали. Иначе система логов сама становится
        // хранилищем персональных данных.
        audit.record(actor, "lead.triage", "lead", lead.getId().toString(),
                Map.of("from", wasStatus, "to", lead.getStatus(),
                        "owner", lead.getOwner() == null ? "-" : lead.getOwner()));
        return view(lead);
    }

    private static LeadRow row(Lead l, UUID dealId) {
        return new LeadRow(l.getId(), l.getForm(), l.getName(), l.getCompany(), l.getPhone(),
                l.getEmail(), l.getProductSlug(), l.getSource(), l.getStatus(), l.getOwner(),
                dealId, l.getCreatedAt());
    }

    private LeadView view(Lead l) {
        return new LeadView(l.getId(), l.getForm(), l.getName(), l.getCompany(), l.getPhone(),
                l.getEmail(), l.getProductSlug(), l.getMessage(), l.getSource(), l.getStatus(),
                l.getOwner(), l.getLanguage(), l.getCampaign(),
                deals.findByLeadId(l.getId()).map(Deal::getId).orElse(null),
                l.getConsentVersion(), l.getConsentAt(), l.getCorrelationId(),
                l.getCreatedAt());
    }

    private Lead find(UUID id) {
        return leads.findById(id).orElseThrow(() -> new NotFoundException("Заявка не найдена"));
    }
}
