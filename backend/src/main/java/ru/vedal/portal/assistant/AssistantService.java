package ru.vedal.portal.assistant;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.audit.AuditLog;

import java.util.List;
import java.util.Map;

@Service
public class AssistantService {

    // Формы передачи из content_model.md → Urania Assistant Model.
    private static final List<String> FORMS = List.of("quote", "catalog", "consultation", "service");

    private static final String NOT_FOUND =
            "По этому вопросу у меня нет согласованных материалов, поэтому отвечать не буду. "
                    + "Передам специалисту — он ответит точно.";

    private final Guardrails guardrails;
    private final LlmEngine engine;
    private final AuditLog audit;
    private final String phone;
    private final String email;

    public AssistantService(Guardrails guardrails, LlmEngine engine, AuditLog audit,
                           @Value("${vedal.contacts.phone}") String phone,
                           @Value("${vedal.contacts.email}") String email) {
        this.guardrails = guardrails;
        this.engine = engine;
        this.audit = audit;
        this.phone = phone;
        this.email = email;
    }

    @Transactional
    public AskReply ask(String question) {
        // Сначала ограничения, потом движок: вопрос про диагноз или цену
        // до поиска не доходит вообще.
        var refusal = guardrails.refuse(question);
        if (refusal.isPresent()) {
            journal("blocked", 0);
            return new AskReply(refusal.get(), List.of(), handoff(refusal.get()));
        }

        var grounded = engine.answer(question);
        if (grounded.isEmpty()) {
            journal("no-sources", 0);
            return new AskReply(NOT_FOUND, List.of(), handoff(NOT_FOUND));
        }

        journal("answered", grounded.get().sources().size());
        return new AskReply(grounded.get().text(), grounded.get().sources(), null);
    }

    private AskReply.Handoff handoff(String reason) {
        return new AskReply.Handoff(reason, phone, email, FORMS);
    }

    // Текст вопроса в журнал не пишем: посетитель может указать в нём и клинику,
    // и себя. Пишем только категорию исхода и число источников — этого хватает
    // для разбора качества ответов и не делает журнал хранилищем ПДн.
    private void journal(String outcome, int sources) {
        audit.record("public", "assistant.ask", "assistant", outcome,
                Map.of("sources", sources));
    }
}
