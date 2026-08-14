package ru.vedal.portal.crm;

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

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// Коммерческие предложения.
//
// Главное правило: КП правится, только пока оно черновик. Отправленное —
// документ, который у клиента уже лежит в почте; правка задним числом
// означала бы, что портал и клиент держат разные версии одного предложения
// и спорят, чья настоящая. Нужны другие условия — заводится новое КП,
// со своим номером.
@Service
public class QuoteDesk implements QuoteAdmin {

    private static final int MAX_PAGE_SIZE = 200;

    // Копейки. Складывать деньги в double — способ получить 1 249 999,99
    // там, где было 1 250 000.
    private static final int SCALE = 2;

    private final QuoteRepository quotes;
    private final DealRepository deals;
    private final DealDesk dealDesk;
    private final DomainEvents events;
    private final AuditLog audit;

    public QuoteDesk(QuoteRepository quotes, DealRepository deals, DealDesk dealDesk,
                     DomainEvents events, AuditLog audit) {
        this.quotes = quotes;
        this.deals = deals;
        this.dealDesk = dealDesk;
        this.events = events;
        this.audit = audit;
    }

    @Override
    @Transactional(readOnly = true)
    public PageView<QuoteRow> quotes(String status, int page, int size) {
        var pageable = PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, MAX_PAGE_SIZE));
        var found = status == null || status.isBlank()
                ? quotes.findAllByOrderByCreatedAtDesc(pageable)
                : quotes.findByStatusOrderByCreatedAtDesc(checkStatus(status), pageable);
        return PageView.of(found, this::row);
    }

    @Override
    @Transactional(readOnly = true)
    public List<QuoteRow> byDeal(UUID dealId) {
        return quotes.findByDealIdOrderByCreatedAtDesc(dealId).stream().map(this::row).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public QuoteView quote(UUID id) {
        return view(find(id));
    }

    @Override
    @Transactional
    public QuoteView create(NewQuote form, String actor) {
        if (form.dealId() == null) {
            throw new ConflictException("КП заводится по сделке: укажите dealId.");
        }
        var deal = dealDesk.require(form.dealId());

        var quote = new Quote();
        quote.setId(UUID.randomUUID());
        quote.setDealId(deal.getId());
        quote.setNumber(nextNumber());
        // Новое КП — черновик. Оно ещё никуда не уехало, и правится свободно.
        quote.setStatus("draft");
        quote.setCurrency(blank(form.currency()) ? deal.getCurrency() : form.currency());
        quote.setValidUntil(form.validUntil());
        quote.setNote(blankToNull(form.note()));
        quote.setCreatedAt(Instant.now());
        quote.setUpdatedAt(Instant.now());
        replaceItems(quote, form.items());
        quotes.saveAndFlush(quote);

        audit.record(actor, "quote.create", "quote", quote.getId().toString(),
                Map.of("number", quote.getNumber(), "deal", deal.getId().toString()));
        return view(quote);
    }

    @Override
    @Transactional
    public QuoteView update(UUID id, QuoteForm form, String actor) {
        var quote = find(id);
        Versions.check(form.version(), quote.getVersion(), "КП");
        onlyDraft(quote, "править");

        if (!blank(form.currency())) quote.setCurrency(form.currency());
        quote.setValidUntil(form.validUntil());
        quote.setNote(blankToNull(form.note()));
        quote.setUpdatedAt(Instant.now());
        replaceItems(quote, form.items());
        quotes.saveAndFlush(quote);

        // Сумма — коммерческие условия: в журнал уходит номер и число позиций,
        // но не цены.
        audit.record(actor, "quote.edit", "quote", quote.getId().toString(),
                Map.of("number", quote.getNumber(), "items", String.valueOf(quote.getItems().size())));
        return view(quote);
    }

    @Override
    @Transactional
    public QuoteView send(UUID id, String actor) {
        var quote = find(id);
        onlyDraft(quote, "отправить");

        if (quote.getItems().isEmpty()) {
            throw new ConflictException("В КП " + quote.getNumber() + " нет ни одной позиции. "
                    + "Отправлять клиенту пустое предложение нечего.");
        }
        // Срок «до вчера» у только что отправленного КП — это не срок,
        // а опечатка, и клиент увидит её раньше нас.
        if (quote.getValidUntil() != null
                && quote.getValidUntil().isBefore(LocalDate.now(ZoneOffset.UTC))) {
            throw new ConflictException("Срок действия КП " + quote.getNumber() + " истёк "
                    + quote.getValidUntil() + ". Продлите его перед отправкой.");
        }

        quote.setStatus("sent");
        quote.setSentAt(Instant.now());
        quote.setUpdatedAt(Instant.now());
        quotes.saveAndFlush(quote);

        // Событие и строка КП коммитятся одним COMMIT. Потребителя у него
        // пока нет: письмо клиенту с самим предложением — следующий шаг,
        // и он упирается в SMTP Яндекс 360, которого ещё нет.
        events.record("quote", quote.getId().toString(), KafkaTopics.DEALS,
                Map.of("action", "quote.sent", "deal", quote.getDealId().toString(),
                        "number", quote.getNumber()));
        audit.record(actor, "quote.send", "quote", quote.getId().toString(),
                Map.of("number", quote.getNumber(), "deal", quote.getDealId().toString()));
        return view(quote);
    }

    @Override
    @Transactional
    public QuoteView decide(UUID id, Decision decision, String actor) {
        var quote = find(id);

        // Решение бывает только по отправленному. Принять черновик значит
        // записать согласие клиента с тем, чего он не видел.
        if (!"sent".equals(quote.getStatus())) {
            throw new ConflictException("КП " + quote.getNumber() + " в состоянии «"
                    + quote.getStatus() + "». Решение принимается только по отправленному: "
                    + "клиент не может согласиться с тем, чего не получал.");
        }

        quote.setStatus(decision.status());
        quote.setDecidedAt(Instant.now());
        quote.setUpdatedAt(Instant.now());
        quotes.saveAndFlush(quote);

        events.record("quote", quote.getId().toString(), KafkaTopics.DEALS,
                Map.of("action", "quote." + decision.status(),
                        "deal", quote.getDealId().toString(), "number", quote.getNumber()));
        audit.record(actor, "quote.decide", "quote", quote.getId().toString(),
                Map.of("number", quote.getNumber(), "status", quote.getStatus()));
        return view(quote);
    }

    private void onlyDraft(Quote quote, String what) {
        if (!"draft".equals(quote.getStatus())) {
            throw new ConflictException("КП " + quote.getNumber() + " уже "
                    + (quote.getSentAt() == null ? "закрыто" : "отправлено")
                    + " — " + what + " его нельзя: у клиента лежит другая редакция. "
                    + "Заведите новое КП по этой сделке.");
        }
    }

    private static String checkStatus(String status) {
        if (!STATUSES.contains(status)) {
            throw new ConflictException("Неизвестный статус КП: " + status
                    + ". Допустимые: " + String.join(", ", STATUSES));
        }
        return status;
    }

    // КП-2026-0007. Номер выдаёт последовательность базы: два менеджера,
    // нажавшие «создать» одновременно, получили бы один номер из счётчика
    // в коде — и спор о том, какое предложение действующее.
    private String nextNumber() {
        return "КП-" + LocalDate.now(ZoneOffset.UTC).getYear() + "-"
                + String.format("%04d", quotes.nextNumber());
    }

    private void replaceItems(Quote quote, List<ItemForm> rows) {
        quote.getItems().clear();

        var total = BigDecimal.ZERO;
        var position = 0;
        for (var row : rows == null ? List.<ItemForm>of() : rows) {
            var quantity = row.quantity() == null ? BigDecimal.ONE : row.quantity();
            var price = row.unitPrice() == null ? BigDecimal.ZERO : row.unitPrice();
            var amount = quantity.multiply(price).setScale(SCALE, RoundingMode.HALF_UP);

            var item = new QuoteItem();
            item.setId(UUID.randomUUID());
            item.setPosition(position++);
            item.setProductSlug(blankToNull(row.productSlug()));
            item.setName(row.name().trim());
            item.setQuantity(quantity);
            item.setUnitPrice(price.setScale(SCALE, RoundingMode.HALF_UP));
            item.setAmount(amount);
            quote.getItems().add(item);

            total = total.add(amount);
        }

        quote.setTotal(total.setScale(SCALE, RoundingMode.HALF_UP));
    }

    private QuoteRow row(Quote q) {
        return new QuoteRow(q.getId(), q.getDealId(), dealTitle(q.getDealId()), q.getNumber(),
                q.getStatus(), q.getTotal(), q.getCurrency(), q.getValidUntil(),
                q.getSentAt(), q.getCreatedAt());
    }

    private QuoteView view(Quote q) {
        return new QuoteView(q.getId(), q.getVersion(), q.getDealId(), dealTitle(q.getDealId()),
                q.getNumber(), q.getStatus(), q.getTotal(), q.getCurrency(), q.getValidUntil(),
                q.getNote(),
                q.getItems().stream()
                        .map(i -> new ItemView(i.getProductSlug(), i.getName(), i.getQuantity(),
                                i.getUnitPrice(), i.getAmount()))
                        .toList(),
                q.getSentAt(), q.getDecidedAt(), q.getCreatedAt(), q.getUpdatedAt());
    }

    private String dealTitle(UUID dealId) {
        return deals.findById(dealId).map(Deal::getTitle).orElse(null);
    }

    private Quote find(UUID id) {
        return quotes.findById(id).orElseThrow(() -> new NotFoundException("КП не найдено"));
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static String blankToNull(String value) {
        return blank(value) ? null : value;
    }
}
