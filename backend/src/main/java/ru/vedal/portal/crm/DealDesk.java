package ru.vedal.portal.crm;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.audit.AuditLog;
import ru.vedal.portal.common.ConflictException;
import ru.vedal.portal.common.DomainEvents;
import ru.vedal.portal.common.KafkaTopics;
import ru.vedal.portal.common.NotFoundException;
import ru.vedal.portal.common.PageView;
import ru.vedal.portal.common.Versions;
import ru.vedal.portal.documents.DocumentQuery;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

// Сделки всех трёх воронок.
//
// Что здесь сознательно НЕ делается автоматически:
//
//   отправка КП не двигает сделку на стадию «quoted», а принятое КП
//   не переводит её в «won». Соблазн большой, но воронка — это то, что
//   менеджер утверждает про сделку, а не побочный эффект нажатия в соседней
//   карточке. Автоматика, которую никто не заказывал, сначала радует, потом
//   врёт в отчёте, и разобрать её задним числом дороже, чем два клика.
@Service
public class DealDesk implements DealAdmin {

    private static final int MAX_PAGE_SIZE = 200;

    // Название сделки по умолчанию — из формы, с которой пришла заявка.
    private static final Map<String, String> FORM_TITLES = Map.of(
            "quote", "Запрос цены",
            "catalog", "Запрос каталога",
            "consultation", "Консультация",
            "service", "Обращение в сервис",
            "partner", "Партнёрство");

    private final DealRepository deals;
    private final ClientRepository clients;
    private final ClientDesk clientDesk;
    private final LeadRepository leads;
    private final DocumentQuery documents;
    private final DomainEvents events;
    private final AuditLog audit;

    public DealDesk(DealRepository deals, ClientRepository clients, ClientDesk clientDesk,
                    LeadRepository leads, DocumentQuery documents, DomainEvents events,
                    AuditLog audit) {
        this.deals = deals;
        this.clients = clients;
        this.clientDesk = clientDesk;
        this.leads = leads;
        this.documents = documents;
        this.events = events;
        this.audit = audit;
    }

    @Override
    public List<PipelineView> pipelines() {
        return Pipelines.all().stream()
                .map(p -> new PipelineView(p, Pipelines.stages(p)))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public PageView<DealRow> deals(String pipeline, String stage, UUID clientId, int page, int size) {
        var pageable = PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, MAX_PAGE_SIZE));

        Page<Deal> found;
        if (clientId != null) {
            found = deals.findByClientIdOrderByCreatedAtDesc(clientId, pageable);
        } else if (blank(pipeline)) {
            found = deals.findAllByOrderByCreatedAtDesc(pageable);
        } else if (blank(stage)) {
            found = deals.findByPipelineOrderByCreatedAtDesc(pipeline, pageable);
        } else {
            Pipelines.check(pipeline, stage);
            found = deals.findByPipelineAndStageOrderByCreatedAtDesc(pipeline, stage, pageable);
        }

        // Имена клиентов — одним запросом на страницу, а не по запросу
        // на строку: иначе список из пятидесяти сделок это пятьдесят
        // с лишним обращений в базу.
        var names = names(found.getContent().stream().map(Deal::getClientId).distinct().toList());
        return PageView.of(found, d -> new DealRow(d.getId(), d.getClientId(),
                names.get(d.getClientId()), d.getPipeline(), d.getTitle(), d.getStage(),
                d.getAmount(), d.getCurrency(), d.getProductSlug(), d.getOwner(),
                d.getCreatedAt(), d.getUpdatedAt()));
    }

    @Override
    @Transactional(readOnly = true)
    public DealView deal(UUID id) {
        return view(find(id));
    }

    @Override
    @Transactional
    public DealView create(NewDeal form, String actor) {
        if (form.clientId() == null) {
            throw new ConflictException("Сделка заводится по клиенту: укажите clientId. "
                    + "Сделка без клиента ни из одной карточки не находится.");
        }
        var client = clientDesk.require(form.clientId());

        var deal = born(client.getId(), form.pipeline(), form.title(), form.amount(),
                form.currency(), form.productSlug(), form.owner());
        deals.saveAndFlush(deal);

        recorded(deal, "created", actor, Map.of());
        return view(deal);
    }

    @Override
    @Transactional
    public DealView convert(UUID leadId, Conversion form, String actor) {
        var lead = leads.findById(leadId)
                .orElseThrow(() -> new NotFoundException("Заявка не найдена"));

        // Уникальный индекс deal_lead_idx откажет и сам — но редактор должен
        // увидеть, какая сделка уже заведена, а не имя индекса.
        deals.findByLeadId(leadId).ifPresent(existing -> {
            throw new ConflictException("Заявка уже разобрана в сделку «" + existing.getTitle()
                    + "». Второй разбор создал бы две сделки по одному обращению, и обе "
                    + "попали бы в аналитику.");
        });

        var client = form.clientId() == null
                ? clientDesk.fromLead(lead, actor)
                : clientDesk.require(form.clientId());

        var deal = born(client.getId(), form.pipeline(), title(form.title(), lead), form.amount(),
                null, lead.getProductSlug(), form.owner() == null ? lead.getOwner() : form.owner());
        deal.setLeadId(lead.getId());
        deals.saveAndFlush(deal);

        // Разобранная в сделку заявка перестаёт быть черновиком: она уже
        // в работе, и оставлять её в списке «разобрать» значит разобрать
        // её второй раз.
        if ("draft".equals(lead.getStatus()) || "new".equals(lead.getStatus())) {
            lead.setStatus("in_progress");
            leads.save(lead);
        }
        if (lead.getOwner() == null && deal.getOwner() != null) {
            lead.setOwner(deal.getOwner());
            leads.save(lead);
        }

        recorded(deal, "created", actor, Map.of("fromLead", lead.getId().toString()));
        // Заявка тоже получает запись: по ней в журнале видно, во что она
        // превратилась, без обхода всех сделок.
        audit.record(actor, "lead.convert", "lead", lead.getId().toString(),
                Map.of("deal", deal.getId().toString(), "pipeline", deal.getPipeline()));
        return view(deal);
    }

    @Override
    @Transactional
    public DealView update(UUID id, DealForm form, String actor) {
        var deal = find(id);
        Versions.check(form.version(), deal.getVersion(), "Карточку сделки");

        deal.setTitle(form.title().trim());
        deal.setAmount(form.amount());
        if (!blank(form.currency())) deal.setCurrency(form.currency());
        deal.setProductSlug(blankToNull(form.productSlug()));
        deal.setOwner(blankToNull(form.owner()));
        deal.setUpdatedAt(Instant.now());
        deals.saveAndFlush(deal);

        // Суммы в журнал не пишем: это коммерческие условия из раздела
        // «не выносим наружу». В журнале — что карточку правили и кто.
        audit.record(actor, "deal.edit", "deal", deal.getId().toString(),
                Map.of("pipeline", deal.getPipeline(), "stage", deal.getStage()));
        return view(deal);
    }

    @Override
    @Transactional
    public DealView moveTo(UUID id, StageChange change, String actor) {
        var deal = find(id);
        Pipelines.check(deal.getPipeline(), change.stage());

        if (deal.getStage().equals(change.stage())) return view(deal);

        var reason = blankToNull(change.lostReason());
        if (Pipelines.isLost(change.stage()) && reason == null) {
            throw new ConflictException("Укажите причину: воронка без причин проигрыша "
                    + "показывает, сколько потеряли, и молчит о том, почему.");
        }

        var was = deal.getStage();
        deal.setStage(change.stage());
        deal.setLostReason(Pipelines.isLost(change.stage()) ? reason : null);
        // Вернуть закрытую сделку в работу можно: ошибаются и здесь.
        // Тогда отметка о закрытии снимается, иначе сделка остаётся открытой
        // с датой закрытия в прошлом.
        deal.setClosedAt(Pipelines.isClosed(change.stage()) ? Instant.now() : null);
        deal.setUpdatedAt(Instant.now());
        deals.saveAndFlush(deal);

        recorded(deal, "stage", actor, Map.of("from", was, "to", deal.getStage()));
        return view(deal);
    }

    @Override
    @Transactional
    public DealView attach(UUID id, Attach attach, String actor) {
        var deal = find(id);
        if (attach == null || attach.documentId() == null) {
            throw new ConflictException("Укажите документ");
        }

        var document = documents.ref(attach.documentId())
                .orElseThrow(() -> new NotFoundException("Документ не найден"));

        // Требование из functional_requirements — «вложения из согласованных
        // документов». Несогласованный документ, уехавший клиенту в КП,
        // отзывается только письмом с извинениями.
        if (!document.approved()) {
            throw new ConflictException("Документ «" + document.title()
                    + "» не согласован к публикации. К сделке прикладываются только "
                    + "согласованные: несогласованный отзывается уже только письмом.");
        }

        var already = deal.getAttachments().stream()
                .anyMatch(a -> a.getDocumentId().equals(document.id()));
        if (already) {
            throw new ConflictException("Документ «" + document.title() + "» уже приложен.");
        }

        deal.getAttachments().add(new DealAttachment(document.id(), actor));
        deal.setUpdatedAt(Instant.now());
        deals.saveAndFlush(deal);

        audit.record(actor, "deal.attach", "deal", deal.getId().toString(),
                Map.of("document", document.slug()));
        return view(deal);
    }

    @Override
    @Transactional
    public DealView detach(UUID id, UUID documentId, String actor) {
        var deal = find(id);
        var removed = deal.getAttachments().removeIf(a -> a.getDocumentId().equals(documentId));
        if (!removed) {
            throw new NotFoundException("Такой документ к сделке не приложен");
        }

        deal.setUpdatedAt(Instant.now());
        deals.saveAndFlush(deal);

        audit.record(actor, "deal.detach", "deal", deal.getId().toString(),
                Map.of("document", documentId.toString()));
        return view(deal);
    }

    Deal require(UUID id) {
        return find(id);
    }

    private Deal born(UUID clientId, String pipeline, String title, java.math.BigDecimal amount,
                      String currency, String productSlug, String owner) {
        // Воронка проверяется до записи: неизвестная воронка означала бы
        // сделку без набора стадий, которую нельзя ни двинуть, ни закрыть.
        var stage = Pipelines.first(pipeline);

        var deal = new Deal();
        deal.setId(UUID.randomUUID());
        deal.setClientId(clientId);
        deal.setPipeline(pipeline);
        deal.setStage(stage);
        deal.setTitle(title == null || title.isBlank() ? "Без названия" : title.trim());
        deal.setAmount(amount);
        if (!blank(currency)) deal.setCurrency(currency);
        deal.setProductSlug(blankToNull(productSlug));
        deal.setOwner(blankToNull(owner));
        deal.setCreatedAt(Instant.now());
        deal.setUpdatedAt(Instant.now());
        return deal;
    }

    // Событие и запись журнала — в той же транзакции, что и сама сделка.
    // В payload только идентификаторы и стадия: ни имени клиента, ни суммы,
    // ни контактов. Топик живёт вне карточки, и всё, что туда попало,
    // считается уехавшим.
    private void recorded(Deal deal, String action, String actor, Map<String, String> extra) {
        var payload = new LinkedHashMap<String, String>();
        payload.put("action", action);
        payload.put("pipeline", deal.getPipeline());
        payload.put("stage", deal.getStage());
        payload.putAll(extra);

        events.record("deal", deal.getId().toString(), KafkaTopics.DEALS, payload);
        audit.record(actor, "deal." + action, "deal", deal.getId().toString(), payload);
    }

    private static String title(String given, Lead lead) {
        if (given != null && !given.isBlank()) return given.trim();
        var base = FORM_TITLES.getOrDefault(lead.getForm(), "Обращение");
        return lead.getProductSlug() == null ? base : base + " — " + lead.getProductSlug();
    }

    private Map<UUID, String> names(List<UUID> clientIds) {
        if (clientIds.isEmpty()) return Map.of();
        return clients.findAllById(clientIds).stream()
                .collect(Collectors.toMap(Client::getId, Client::getName));
    }

    private DealView view(Deal d) {
        var client = clients.findById(d.getClientId()).orElse(null);
        return new DealView(d.getId(), d.getVersion(), d.getClientId(),
                client == null ? null : client.getName(), d.getLeadId(), d.getPipeline(),
                d.getTitle(), d.getStage(), Pipelines.stages(d.getPipeline()), d.getAmount(),
                d.getCurrency(), d.getProductSlug(), d.getOwner(), d.getClosedAt(),
                d.getLostReason(), attachments(d), d.getCreatedAt(), d.getUpdatedAt());
    }

    private List<AttachmentView> attachments(Deal deal) {
        if (deal.getAttachments().isEmpty()) return List.of();

        var refs = documents.refs(deal.getAttachments().stream()
                        .map(DealAttachment::getDocumentId).toList()).stream()
                .collect(Collectors.toMap(DocumentQuery.Ref::id, Function.identity()));

        // Документ, снятый с публикации после того, как его приложили,
        // из карточки не пропадает: он уже уехал клиенту, и делать вид,
        // что вложения не было, — врать самим себе.
        return deal.getAttachments().stream()
                .map(a -> {
                    var ref = refs.get(a.getDocumentId());
                    return new AttachmentView(a.getDocumentId(),
                            ref == null ? null : ref.slug(),
                            ref == null ? "Документ удалён" : ref.title(),
                            a.getAttachedBy(), a.getAttachedAt());
                })
                .toList();
    }

    private Deal find(UUID id) {
        return deals.findById(id).orElseThrow(() -> new NotFoundException("Сделка не найдена"));
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static String blankToNull(String value) {
        return blank(value) ? null : value;
    }
}
