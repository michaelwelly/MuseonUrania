package ru.vedal.portal.admin.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.vedal.portal.common.PageView;
import ru.vedal.portal.crm.ClientAdmin;
import ru.vedal.portal.crm.CrmHistory;

import java.util.List;
import java.util.UUID;

// Клиентская база. Как и заявки, отдаёт персональные данные — и по той же
// причине размер страницы ограничен сверху.
@RestController
@RequestMapping("/api/admin/v1")
@Tag(name = "Админка: клиенты")
@SecurityRequirement(name = "keycloak")
public class AdminClientsApi {

    private final ClientAdmin clients;
    private final CrmHistory history;

    public AdminClientsApi(ClientAdmin clients, CrmHistory history) {
        this.clients = clients;
        this.history = history;
    }

    @Operation(summary = "Клиенты постранично, по алфавиту")
    @GetMapping("/clients")
    public PageView<ClientAdmin.ClientRow> clients(
            @Parameter(description = "Поиск по наименованию и ИНН. Пусто — все.")
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Размер страницы, не больше 200.")
            @RequestParam(defaultValue = "50") int size) {
        return clients.clients(query, page, size);
    }

    @Operation(summary = "Виды клиента")
    @GetMapping("/clients/kinds")
    public List<String> kinds() {
        return ClientAdmin.KINDS;
    }

    @Operation(summary = "Карточка клиента")
    @GetMapping("/clients/{id}")
    public ClientAdmin.ClientView client(@PathVariable UUID id) {
        return clients.client(id);
    }

    @Operation(summary = "Завести клиента")
    @PostMapping("/clients")
    @ResponseStatus(HttpStatus.CREATED)
    public ClientAdmin.ClientView create(@Valid @RequestBody ClientAdmin.ClientForm form,
                                         Authentication who) {
        return clients.create(form, Actor.of(who));
    }

    @Operation(summary = "Править карточку клиента",
            description = "Форма отправляется вместе с версией прочитанной карточки. "
                    + "Расхождение версий — `409`: сохранить вслепую значит затереть чужую правку.")
    @PutMapping("/clients/{id}")
    public ClientAdmin.ClientView update(@PathVariable UUID id,
                                         @Valid @RequestBody ClientAdmin.ClientForm form,
                                         Authentication who) {
        return clients.update(id, form, Actor.of(who));
    }

    @Operation(summary = "История переписки и звонков по клиенту")
    @GetMapping("/clients/{id}/history")
    public List<CrmHistory.Entry> history(@PathVariable UUID id) {
        return history.ofClient(id);
    }

    @Operation(summary = "Дописать в историю клиента",
            description = "История только дописывается: правки и удаления здесь нет. "
                    + "Историю, которую можно поправить задним числом, незачем вести.")
    @PostMapping("/clients/{id}/history")
    @ResponseStatus(HttpStatus.CREATED)
    public CrmHistory.Entry addToHistory(@PathVariable UUID id,
                                         @Valid @RequestBody CrmHistory.NewEntry entry,
                                         Authentication who) {
        return history.addToClient(id, entry, Actor.of(who));
    }
}
