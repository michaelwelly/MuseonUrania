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
import ru.vedal.portal.crm.QuoteAdmin;

import java.util.List;
import java.util.UUID;

// Коммерческие предложения.
//
// Цены здесь называет менеджер, и наружу они не уходят: правило «не выдумывать
// цены» действует на сайт, каталог и Ведалину, а КП — внутренний документ,
// который человек составляет и подписывает сам.
@RestController
@RequestMapping("/api/admin/v1")
@Tag(name = "Админка: коммерческие предложения")
@SecurityRequirement(name = "keycloak")
public class AdminQuotesApi {

    private final QuoteAdmin quotes;

    public AdminQuotesApi(QuoteAdmin quotes) {
        this.quotes = quotes;
    }

    @Operation(summary = "КП постранично, свежие сверху")
    @GetMapping("/quotes")
    public PageView<QuoteAdmin.QuoteRow> quotes(
            @Parameter(description = "Фильтр по статусу. Пусто — все.")
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Размер страницы, не больше 200.")
            @RequestParam(defaultValue = "50") int size) {
        return quotes.quotes(status, page, size);
    }

    @Operation(summary = "Статусы КП")
    @GetMapping("/quotes/statuses")
    public List<String> statuses() {
        return QuoteAdmin.STATUSES;
    }

    @Operation(summary = "КП целиком, вместе с позициями")
    @GetMapping("/quotes/{id}")
    public QuoteAdmin.QuoteView quote(@PathVariable UUID id) {
        return quotes.quote(id);
    }

    @Operation(summary = "Завести КП по сделке",
            description = "Новое КП — черновик со своим номером. Номер выдаёт последовательность "
                    + "базы: двое, нажавшие «создать» одновременно, получат разные номера.")
    @PostMapping("/quotes")
    @ResponseStatus(HttpStatus.CREATED)
    public QuoteAdmin.QuoteView create(@Valid @RequestBody QuoteAdmin.NewQuote form,
                                       Authentication who) {
        return quotes.create(form, Actor.of(who));
    }

    @Operation(summary = "Править КП",
            description = """
                    Правится только черновик. Отправленное КП уже лежит у клиента в почте,
                    и правка задним числом означала бы, что портал и клиент держат разные
                    версии одного предложения. Нужны другие условия — заведите новое КП.

                    Позиции заменяются целиком: редактор видит их одним списком.
                    """)
    @PutMapping("/quotes/{id}")
    public QuoteAdmin.QuoteView update(@PathVariable UUID id,
                                       @Valid @RequestBody QuoteAdmin.QuoteForm form,
                                       Authentication who) {
        return quotes.update(id, form, Actor.of(who));
    }

    @Operation(summary = "Отметить КП отправленным",
            description = """
                    Письмо портал пока не шлёт: `MailSender` пишет в лог, SMTP Яндекс 360 —
                    следующий шаг. Отметка фиксирует, что предложение ушло, и с этого момента
                    оно не правится.
                    """)
    @PostMapping("/quotes/{id}/send")
    public QuoteAdmin.QuoteView send(@PathVariable UUID id, Authentication who) {
        return quotes.send(id, Actor.of(who));
    }

    @Operation(summary = "Решение клиента по КП",
            description = "Только по отправленному: клиент не может согласиться с тем, "
                    + "чего не получал.")
    @PostMapping("/quotes/{id}/decision")
    public QuoteAdmin.QuoteView decide(@PathVariable UUID id,
                                       @Valid @RequestBody QuoteAdmin.Decision decision,
                                       Authentication who) {
        return quotes.decide(id, decision, Actor.of(who));
    }
}
