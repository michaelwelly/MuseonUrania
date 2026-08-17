package ru.vedal.portal.crm;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.audit.AuditLog;
import ru.vedal.portal.common.ConflictException;
import ru.vedal.portal.common.NotFoundException;
import ru.vedal.portal.common.PageView;
import ru.vedal.portal.common.Versions;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

// Клиентская база. Правила живут здесь, а не в контроллере: контроллер —
// транспорт, и правило, записанное в нём, действует ровно до появления
// второго транспорта.
@Service
public class ClientDesk implements ClientAdmin {

    // Та же верхняя граница, что у заявок: это тоже персональные данные,
    // и ?size=1000000 не должен превращать список в выгрузку всей базы.
    private static final int MAX_PAGE_SIZE = 200;

    private final ClientRepository clients;
    private final DealRepository deals;
    private final AuditLog audit;

    public ClientDesk(ClientRepository clients, DealRepository deals, AuditLog audit) {
        this.clients = clients;
        this.deals = deals;
        this.audit = audit;
    }

    @Override
    @Transactional(readOnly = true)
    public PageView<ClientRow> clients(String query, int page, int size) {
        var pageable = PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, MAX_PAGE_SIZE));
        var found = query == null || query.isBlank()
                ? clients.findAllByOrderByNameAsc(pageable)
                : clients.search(query.trim(), pageable);
        return PageView.of(found, this::row);
    }

    @Override
    @Transactional(readOnly = true)
    public ClientView client(UUID id) {
        return view(find(id));
    }

    @Override
    @Transactional
    public ClientView create(ClientForm form, String actor) {
        var client = new Client();
        client.setId(UUID.randomUUID());
        client.setCreatedAt(Instant.now());
        apply(client, form, null);
        clients.saveAndFlush(client);

        // В журнале нет ни контактов, ни названия: только идентификатор
        // и то, что карточку завели. Иначе журнал сам становится копией
        // клиентской базы.
        audit.record(actor, "client.create", "client", client.getId().toString(),
                Map.of("kind", client.getKind()));
        return view(client);
    }

    @Override
    @Transactional
    public ClientView update(UUID id, ClientForm form, String actor) {
        var client = find(id);
        Versions.check(form.version(), client.getVersion(), "Карточку клиента");

        apply(client, form, client.getId());
        clients.saveAndFlush(client);

        audit.record(actor, "client.edit", "client", client.getId().toString(),
                Map.of("kind", client.getKind()));
        return view(client);
    }

    /**
     * Клиент по данным заявки — для разбора лида в сделку.
     * <p>
     * Существующего клиента не ищет и не подклеивает намеренно. Совпадение
     * по названию или почте — догадка: «Городская больница №1» бывает в трёх
     * городах, а с одного адреса пишут разные люди одной организации. Слить
     * две карточки потом можно, разделить ошибочно слитые — уже нет. Поэтому
     * выбор существующего клиента остаётся за менеджером: он передаёт
     * {@code clientId} в разбор заявки.
     */
    @Transactional
    Client fromLead(Lead lead, String actor) {
        var client = new Client();
        client.setId(UUID.randomUUID());
        client.setCreatedAt(Instant.now());
        client.setUpdatedAt(Instant.now());
        // Компания, если она указана; иначе имя обратившегося. Заявка
        // с частного адреса — это тоже клиент, просто человек.
        var company = blankToNull(lead.getCompany());
        client.setName(company == null ? lead.getName() : company);
        client.setKind(company == null ? "person" : "company");
        client.setEmail(lead.getEmail());
        client.setPhone(lead.getPhone());
        client.setOwner(lead.getOwner());
        clients.saveAndFlush(client);

        audit.record(actor, "client.create", "client", client.getId().toString(),
                Map.of("kind", client.getKind(), "fromLead", lead.getId().toString()));
        return client;
    }

    Client require(UUID id) {
        return find(id);
    }

    private void apply(Client client, ClientForm form, UUID self) {
        var inn = blankToNull(form.inn());
        var externalId = blankToNull(form.externalId());

        // Естественные ключи проверяем заранее: база откажет уникальным
        // индексом, но редактор должен увидеть, с какой карточкой конфликт,
        // а не имя индекса.
        if (inn != null) {
            clients.findByInn(inn)
                    .filter(other -> !other.getId().equals(self))
                    .ifPresent(other -> {
                        throw new ConflictException("Клиент с ИНН " + inn + " уже заведён: «"
                                + other.getName() + "». Дублировать его значит развести историю "
                                + "одной организации по двум карточкам.");
                    });
        }
        if (externalId != null) {
            clients.findByExternalId(externalId)
                    .filter(other -> !other.getId().equals(self))
                    .ifPresent(other -> {
                        throw new ConflictException("Внешний идентификатор " + externalId
                                + " уже стоит у клиента «" + other.getName() + "».");
                    });
        }

        client.setName(form.name().trim());
        client.setKind(form.kind());
        client.setInn(inn);
        client.setKpp(blankToNull(form.kpp()));
        client.setExternalId(externalId);
        client.setCountry(blankToNull(form.country()));
        client.setCity(blankToNull(form.city()));
        client.setEmail(blankToNull(form.email()));
        client.setPhone(blankToNull(form.phone()));
        client.setNote(blankToNull(form.note()));
        client.setOwner(blankToNull(form.owner()));
        client.setUpdatedAt(Instant.now());
    }

    private ClientRow row(Client c) {
        return new ClientRow(c.getId(), c.getName(), c.getKind(), c.getInn(), c.getCity(),
                c.getOwner(), deals.countByClientId(c.getId()), c.getUpdatedAt());
    }

    private static ClientView view(Client c) {
        return new ClientView(c.getId(), c.getVersion(), c.getName(), c.getKind(), c.getInn(),
                c.getKpp(), c.getExternalId(), c.getCountry(), c.getCity(), c.getEmail(),
                c.getPhone(), c.getNote(), c.getOwner(), c.getCreatedAt(), c.getUpdatedAt());
    }

    private Client find(UUID id) {
        return clients.findById(id)
                .orElseThrow(() -> new NotFoundException("Клиент не найден"));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
