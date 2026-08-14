package ru.vedal.portal.admin.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ru.vedal.portal.audit.AuditQuery;
import ru.vedal.portal.common.PageView;

import java.util.List;

// Журнал только читается. Двери на правку нет и быть не может: на уровне базы
// UPDATE и DELETE по audit_entry закрыты триггером.
@RestController
@RequestMapping("/api/admin/v1")
@Tag(name = "Админка: журнал")
@SecurityRequirement(name = "keycloak")
public class AdminAuditApi {

    private final AuditQuery audit;

    public AdminAuditApi(AuditQuery audit) {
        this.audit = audit;
    }

    @Operation(summary = "Журнал постранично, свежие сверху")
    @GetMapping("/audit")
    public PageView<AuditQuery.Entry> entries(
            @Parameter(description = "Тип объекта: product, news, document, lead, category.")
            @RequestParam(required = false) String subject,
            @Parameter(description = "Идентификатор объекта — slug или UUID заявки.")
            @RequestParam(required = false) String subjectId,
            @Parameter(description = "Логин исполнителя.")
            @RequestParam(required = false) String actor,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return audit.entries(subject, subjectId, actor, page, size);
    }

    @Operation(summary = "Весь путь одного запроса",
            description = "Цепочка собирается по correlation_id и переживает границу "
                    + "планировщика: relay работает в другом потоке, и без этого связь "
                    + "письма с заявкой, которая его породила, теряется.")
    @GetMapping("/audit/chain/{correlationId}")
    public List<AuditQuery.Entry> chain(@PathVariable String correlationId) {
        return audit.chain(correlationId);
    }
}
