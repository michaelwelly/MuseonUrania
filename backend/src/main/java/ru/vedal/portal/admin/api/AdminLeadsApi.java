package ru.vedal.portal.admin.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ru.vedal.portal.common.PageView;
import ru.vedal.portal.crm.LeadAdmin;

import java.util.List;
import java.util.UUID;

// Заявки. Единственная дверь, отдающая персональные данные, и потому
// единственная, где размер страницы ограничен сверху: ?size=1000000 не должен
// превращать список в выгрузку всей базы одним запросом.
@RestController
@RequestMapping("/api/admin/v1")
@Tag(name = "Админка: заявки")
@SecurityRequirement(name = "keycloak")
public class AdminLeadsApi {

    private final LeadAdmin leads;

    public AdminLeadsApi(LeadAdmin leads) {
        this.leads = leads;
    }

    @Operation(summary = "Заявки постранично, свежие сверху")
    @GetMapping("/leads")
    public PageView<LeadAdmin.LeadRow> leads(
            @Parameter(description = "Фильтр по статусу. Пусто — все.")
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Размер страницы, не больше 200.")
            @RequestParam(defaultValue = "50") int size) {
        return leads.leads(status, page, size);
    }

    @Operation(summary = "Статусы заявки")
    @GetMapping("/leads/statuses")
    public List<String> statuses() {
        return LeadAdmin.STATUSES;
    }

    @Operation(summary = "Заявка целиком, с текстом и версией согласия")
    @GetMapping("/leads/{id}")
    public LeadAdmin.LeadView lead(@PathVariable UUID id) {
        return leads.lead(id);
    }

    @Operation(summary = "Разобрать заявку: статус и ответственный",
            description = "Изменение попадает в журнал без персональных данных — "
                    + "только идентификатор заявки, старый и новый статус.")
    @PostMapping("/leads/{id}/triage")
    public LeadAdmin.LeadView triage(@PathVariable UUID id,
                                     @Valid @RequestBody LeadAdmin.Triage triage,
                                     Authentication who) {
        return leads.triage(id, triage, Actor.of(who));
    }
}
