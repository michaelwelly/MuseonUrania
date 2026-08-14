package ru.vedal.portal.crm;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

// История переписки и звонков.
//
// Дверь только на чтение и дописывание — правки и удаления здесь нет,
// и это решение, а не незаконченность. История, которую можно поправить
// задним числом, перестаёт быть историей ровно тогда, когда она нужна:
// при разборе спора о том, что клиенту обещали. По той же причине
// append-only сделан журнал аудита.
public interface CrmHistory {

    List<String> KINDS = List.of("call", "email", "meeting", "note");

    @Schema(name = "AdminInteraction", description = """
            Запись истории. Текст — персональные данные: наружу и в топики
            не уходит, туда идёт только идентификатор.
            """)
    record Entry(UUID id, UUID dealId, UUID clientId, UUID leadId, String kind, String direction,
                 Instant at, String subject, String body, String actor) {}

    @Schema(name = "AdminNewInteraction", description = "Новая запись истории.")
    record NewEntry(
            @Schema(allowableValues = {"call", "email", "meeting", "note"}, example = "call")
            @NotBlank
            @Pattern(regexp = "call|email|meeting|note", message = "Вид записи: call, email, meeting или note")
            String kind,

            @Schema(description = "Направление: `in` — от клиента, `out` — клиенту. "
                    + "У заметки направления нет.",
                    allowableValues = {"in", "out"}, nullable = true)
            @Pattern(regexp = "^$|in|out", message = "Направление: in или out")
            String direction,

            @Schema(description = "Когда это было. Пусто — сейчас. Звонок записывают "
                    + "после разговора, и время разговора важнее времени записи.",
                    nullable = true)
            Instant at,

            @Size(max = 300) String subject,

            @NotBlank(message = "Пустая запись истории ничего не сохраняет")
            String body) {}

    List<Entry> ofDeal(UUID dealId);

    List<Entry> ofClient(UUID clientId);

    List<Entry> ofLead(UUID leadId);

    Entry addToDeal(UUID dealId, NewEntry entry, String actor);

    Entry addToClient(UUID clientId, NewEntry entry, String actor);

    Entry addToLead(UUID leadId, NewEntry entry, String actor);
}
