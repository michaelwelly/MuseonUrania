package ru.vedal.portal.admin.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.vedal.portal.assistant.AskReply;
import ru.vedal.portal.assistant.AskRequest;
import ru.vedal.portal.assistant.AssistantService;
import ru.vedal.portal.assistant.LlmEngine;

// Ведалина для сотрудника. §10.3 плана.
//
// Дверь отдельная, а не флаг на публичной. Публичная дверь открыта всем
// и обязана оставаться такой; область поиска на ней не должна зависеть
// ни от заголовка, ни от параметра — иначе однажды окажется, что «внутренний»
// режим включается тем, кто до него додумался.
//
// Здесь же адрес начинается с /api/admin/, а этот префикс закрыт отдельной
// цепочкой безопасности: без токена и без роли портала запрос сюда
// не доходит вовсе.
//
// Ограничения (диагнозы, цены) действуют одинаково в обоих контурах: вход
// в админку не даёт права спрашивать про лечение.
@RestController
@RequestMapping("/api/admin/v1/assistant")
@Tag(name = "Админка: ассистент")
@SecurityRequirement(name = "keycloak")
public class AdminAssistantApi {

    private final AssistantService assistant;

    public AdminAssistantApi(AssistantService assistant) {
        this.assistant = assistant;
    }

    @Operation(summary = "Спросить Ведалину по внутренним материалам",
            description = """
                    То же, что публичная дверь, но область поиска шире: к каталогу,
                    ленте и публичным документам добавляются документы уровня
                    `internal`.

                    Документы уровня `confidential` не входят и сюда. Вход в админку
                    не является тем «отдельным разрешением», по которому их выдают:
                    они не фильтруются из ответа, а вообще не попадают в контекст
                    поиска.

                    Ограничения те же, что на публичной двери: вопрос про диагноз
                    или цену отклоняется до поиска. Не нашлось источников — приходит
                    `handoff`, а не выдуманный ответ.

                    В журнале действие записывается на того, кто спросил.
                    """)
    @ApiResponse(responseCode = "200",
            description = "Ответ со ссылками на источники либо передача человеку.")
    @ApiResponse(responseCode = "400", description = "Вопрос пуст или длиннее 500 символов.",
            content = @Content(mediaType = "application/problem+json",
                    schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
    @PostMapping("/ask")
    public AskReply ask(@Valid @RequestBody AskRequest request, Authentication authentication) {
        return assistant.ask(request.question(), LlmEngine.Scope.STAFF, Actor.of(authentication));
    }
}
