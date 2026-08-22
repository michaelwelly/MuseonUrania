package ru.vedal.portal.admin.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
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
import ru.vedal.portal.crm.CrmHistory;
import ru.vedal.portal.crm.DealAdmin;
import ru.vedal.portal.crm.QuoteAdmin;

import java.util.List;
import java.util.UUID;

// Сделки всех трёх воронок: продажи, дилерская, сервисная.
//
// Суммы и условия наружу не отдаются: этой двери нет ни в публичном API,
// ни в спецификации для интеграторов — только в админской группе.
@RestController
@RequestMapping("/api/admin/v1")
@Tag(name = "Админка: сделки")
@SecurityRequirement(name = "keycloak")
public class AdminDealsApi {

    private final DealAdmin deals;
    private final QuoteAdmin quotes;
    private final CrmHistory history;

    public AdminDealsApi(DealAdmin deals, QuoteAdmin quotes, CrmHistory history) {
        this.deals = deals;
        this.quotes = quotes;
        this.history = history;
    }

    @Operation(summary = "Воронки и их стадии",
            description = "Набор стадий у каждой воронки свой. Форма рисует выбор из них, "
                    + "а стадию из чужой воронки не примет ни домен, ни схема.")
    @GetMapping("/deals/pipelines")
    public List<DealAdmin.PipelineView> pipelines() {
        return deals.pipelines();
    }

    @Operation(summary = "Сделки постранично, свежие сверху")
    @GetMapping("/deals")
    public PageView<DealAdmin.DealRow> deals(
            @Parameter(description = "Фильтр по воронке: sales, dealer, service. Пусто — все.")
            @RequestParam(required = false) String pipeline,
            @Parameter(description = "Фильтр по стадии. Стадия из чужой воронки — «409».")
            @RequestParam(required = false) String stage,
            @Parameter(description = "Все сделки одного клиента. Сужает наравне с воронкой, "
                    + "а не вместо неё.")
            @RequestParam(required = false) UUID clientId,
            @Parameter(description = "Логин ответственного; «-» — без ответственного.")
            @RequestParam(required = false) String owner,
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Размер страницы, не больше 200.")
            @RequestParam(defaultValue = "50") int size) {
        return deals.deals(new DealAdmin.Filter(pipeline, stage, clientId, owner), page, size);
    }

    @Operation(summary = "Карточка сделки")
    @GetMapping("/deals/{id}")
    public DealAdmin.DealView deal(@PathVariable UUID id) {
        return deals.deal(id);
    }

    @Operation(summary = "Завести сделку по существующему клиенту",
            description = "Сделка из заявки заводится другой дверью — `POST /leads/{id}/convert`.")
    @PostMapping("/deals")
    @ResponseStatus(HttpStatus.CREATED)
    public DealAdmin.DealView create(@Valid @RequestBody DealAdmin.NewDeal form,
                                     Authentication who) {
        return deals.create(form, Actor.of(who));
    }

    @Operation(summary = "Править карточку сделки",
            description = "Стадия меняется отдельной дверью: перевод по воронке — это событие, "
                    + "а не правка поля.")
    @PutMapping("/deals/{id}")
    public DealAdmin.DealView update(@PathVariable UUID id,
                                     @Valid @RequestBody DealAdmin.DealForm form,
                                     Authentication who) {
        return deals.update(id, form, Actor.of(who));
    }

    @Operation(summary = "Перевести сделку на другую стадию",
            description = """
                    Стадия обязана быть из воронки этой сделки. Перевод в проигранную стадию
                    требует причины: воронка без причин показывает, сколько потеряли,
                    и молчит о том, почему.
                    """)
    @PostMapping("/deals/{id}/stage")
    public DealAdmin.DealView moveTo(@PathVariable UUID id,
                                     @Valid @RequestBody DealAdmin.StageChange change,
                                     Authentication who) {
        return deals.moveTo(id, change, Actor.of(who));
    }

    @Operation(summary = "Приложить согласованный документ к сделке",
            description = "Прикладывается ссылка на карточку документа, а не копия файла. "
                    + "Несогласованный документ приложить нельзя — `409` с разбором причины.")
    @PostMapping("/deals/{id}/attachments")
    public DealAdmin.DealView attach(@PathVariable UUID id,
                                     @Valid @RequestBody DealAdmin.Attach attach,
                                     Authentication who) {
        return deals.attach(id, attach, Actor.of(who));
    }

    @Operation(summary = "Отцепить документ от сделки")
    @DeleteMapping("/deals/{id}/attachments/{documentId}")
    public DealAdmin.DealView detach(@PathVariable UUID id, @PathVariable UUID documentId,
                                     Authentication who) {
        return deals.detach(id, documentId, Actor.of(who));
    }

    @Operation(summary = "КП по сделке, свежие сверху")
    @GetMapping("/deals/{id}/quotes")
    public List<QuoteAdmin.QuoteRow> quotes(@PathVariable UUID id) {
        return quotes.byDeal(id);
    }

    @Operation(summary = "История переписки и звонков по сделке")
    @GetMapping("/deals/{id}/history")
    public List<CrmHistory.Entry> history(@PathVariable UUID id) {
        return history.ofDeal(id);
    }

    @Operation(summary = "Дописать в историю сделки",
            description = "История только дописывается: правки и удаления здесь нет.")
    @PostMapping("/deals/{id}/history")
    @ResponseStatus(HttpStatus.CREATED)
    public CrmHistory.Entry addToHistory(@PathVariable UUID id,
                                         @Valid @RequestBody CrmHistory.NewEntry entry,
                                         Authentication who) {
        return history.addToDeal(id, entry, Actor.of(who));
    }
}
