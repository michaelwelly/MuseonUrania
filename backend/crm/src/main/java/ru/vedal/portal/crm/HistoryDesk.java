package ru.vedal.portal.crm;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.audit.AuditLog;
import ru.vedal.portal.common.NotFoundException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// История переписки и звонков. Только чтение и дописывание.
@Service
public class HistoryDesk implements CrmHistory {

    private final InteractionRepository interactions;
    private final DealRepository deals;
    private final ClientRepository clients;
    private final LeadRepository leads;
    private final AuditLog audit;

    public HistoryDesk(InteractionRepository interactions, DealRepository deals,
                       ClientRepository clients, LeadRepository leads, AuditLog audit) {
        this.interactions = interactions;
        this.deals = deals;
        this.clients = clients;
        this.leads = leads;
        this.audit = audit;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Entry> ofDeal(UUID dealId) {
        return interactions.findByDealIdOrderByAtDesc(dealId).stream().map(HistoryDesk::entry).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Entry> ofClient(UUID clientId) {
        return interactions.findByClientIdOrderByAtDesc(clientId).stream().map(HistoryDesk::entry).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Entry> ofLead(UUID leadId) {
        return interactions.findByLeadIdOrderByAtDesc(leadId).stream().map(HistoryDesk::entry).toList();
    }

    @Override
    @Transactional
    public Entry addToDeal(UUID dealId, NewEntry form, String actor) {
        var deal = deals.findById(dealId)
                .orElseThrow(() -> new NotFoundException("Сделка не найдена"));

        var interaction = born(form, actor);
        interaction.setDealId(deal.getId());
        // Запись, привязанная к сделке, автоматически привязывается и к клиенту:
        // историю смотрят и из карточки клиента тоже, и переписка по сделке —
        // это переписка с ним.
        interaction.setClientId(deal.getClientId());
        interaction.setLeadId(deal.getLeadId());
        return save(interaction, "deal", deal.getId(), actor);
    }

    @Override
    @Transactional
    public Entry addToClient(UUID clientId, NewEntry form, String actor) {
        var client = clients.findById(clientId)
                .orElseThrow(() -> new NotFoundException("Клиент не найден"));

        var interaction = born(form, actor);
        interaction.setClientId(client.getId());
        return save(interaction, "client", client.getId(), actor);
    }

    @Override
    @Transactional
    public Entry addToLead(UUID leadId, NewEntry form, String actor) {
        var lead = leads.findById(leadId)
                .orElseThrow(() -> new NotFoundException("Заявка не найдена"));

        var interaction = born(form, actor);
        interaction.setLeadId(lead.getId());
        return save(interaction, "lead", lead.getId(), actor);
    }

    private Entry save(Interaction interaction, String subject, UUID subjectId, String actor) {
        interactions.saveAndFlush(interaction);

        // В журнале — вид записи и к чему она относится. Ни темы, ни текста:
        // это переписка с человеком, то есть персональные данные, а журнал
        // не должен становиться их вторым хранилищем.
        audit.record(actor, "interaction.add", subject, subjectId.toString(),
                Map.of("kind", interaction.getKind(),
                        "direction", interaction.getDirection() == null ? "-" : interaction.getDirection()));
        return entry(interaction);
    }

    private static Interaction born(NewEntry form, String actor) {
        var interaction = new Interaction();
        interaction.setId(UUID.randomUUID());
        interaction.setKind(form.kind());
        interaction.setDirection(blankToNull(form.direction()));
        // Время события, а не время записи: звонок записывают после
        // разговора, и в истории должен стоять разговор.
        interaction.setAt(form.at() == null ? Instant.now() : form.at());
        interaction.setSubject(blankToNull(form.subject()));
        interaction.setBody(form.body().trim());
        interaction.setActor(actor);
        interaction.setCreatedAt(Instant.now());
        return interaction;
    }

    private static Entry entry(Interaction i) {
        return new Entry(i.getId(), i.getDealId(), i.getClientId(), i.getLeadId(), i.getKind(),
                i.getDirection(), i.getAt(), i.getSubject(), i.getBody(), i.getActor());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
