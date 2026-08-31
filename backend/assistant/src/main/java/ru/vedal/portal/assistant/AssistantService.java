package ru.vedal.portal.assistant;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.audit.AuditLog;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Consumer;

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

    /**
     * @param scope кому отвечаем — посетителю или вошедшему сотруднику (§10.3)
     * @param actor кто спросил; в журнал уходит он, а не «public»,
     *              иначе по записи не понять, кто искал по внутренним материалам
     */
    @Transactional
    public AskReply ask(String question, LlmEngine.Scope scope, String actor) {
        return ask(question, scope, actor, chunk -> { });
    }

    /**
     * То же, но с выдачей ответа по мере готовности.
     *
     * <p>Куски идут только из движка. Отказ ограничений и «нет источников» —
     * наши собственные тексты, известные целиком в момент, когда они
     * понадобились: печатать их по буквам значило бы изображать раздумье
     * над решением, которое уже принято.
     *
     * @param onChunk куда отдавать текст по мере появления. Склейка кусков
     *                равна {@link AskReply#answer()} — на этом держится
     *                правило «показанный черновик совпадает с записанным
     *                ответом».
     */
    @Transactional
    public AskReply ask(String question, LlmEngine.Scope scope, String actor,
                        Consumer<String> onChunk) {
        // Сначала ограничения, потом движок: вопрос про диагноз или цену
        // до поиска не доходит вообще.
        var refusal = guardrails.refuse(question);
        if (refusal.isPresent()) {
            journal(actor, "blocked", 0);
            return new AskReply(refusal.get(), List.of(), handoff(refusal.get()));
        }

        var grounded = engine.answer(question, scope, onChunk);
        if (grounded.isEmpty()) {
            journal(actor, "no-sources", 0);
            return new AskReply(NOT_FOUND, List.of(), handoff(NOT_FOUND));
        }

        journal(actor, "answered", grounded.get().sources().size());
        return new AskReply(grounded.get().text(), grounded.get().sources(), null);
    }

    /**
     * Заготовка по нажатой кнопке.
     *
     * <p>Ограничения здесь не спрашиваются, и это не упущение: заготовка —
     * наш собственный текст, написанный по тем же правилам, а не вопрос
     * посетителя. Проверять её сторожем, поставленным на постороннего,
     * значит проверять себя на то, чего сам не писал.
     *
     * <p>Пустой ответ — намерения такого нет; вызывающий отправляет вопрос
     * обычным путём.
     */
    @Transactional
    public Optional<AskReply> scripted(String intent, String actor) {
        return ScriptedReplies.answerFor(intent).map(text -> {
            journal(actor, "scripted", 0);
            return new AskReply(text, List.of(), null);
        });
    }

    /** Что Ведалина пишет, когда позвали человека, — вместе с контактами. */
    public AskReply callingHuman() {
        return new AskReply(ScriptedReplies.CALLING_HUMAN, List.of(),
                handoff(ScriptedReplies.CALLING_HUMAN));
    }

    private AskReply.Handoff handoff(String reason) {
        return new AskReply.Handoff(reason, phone, email, FORMS);
    }

    // Текст вопроса в журнал не пишем: посетитель может указать в нём и клинику,
    // и себя. Пишем только категорию исхода и число источников — этого хватает
    // для разбора качества ответов и не делает журнал хранилищем ПДн.
    private void journal(String actor, String outcome, int sources) {
        audit.record(actor, "assistant.ask", "assistant", outcome,
                Map.of("sources", sources));
    }
}
