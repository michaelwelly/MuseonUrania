package ru.vedal.portal.crm;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import ru.vedal.portal.common.PageView;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

// Дверь модуля для менеджера. Единственное место, где заявка показывается
// с контактами: они персональные данные, и наружу — ни в публичное API,
// ни в топики — не уезжают.
public interface LeadAdmin {

    // Закрыто проверкой в схеме. Продублировано, чтобы админка нарисовала
    // выбор, а не свободное поле.
    List<String> STATUSES = List.of("draft", "new", "in_progress", "won", "lost");

    @Schema(name = "AdminLeadRow", description = """
            Строка списка заявок. Телефон и почта здесь есть: это рабочий
            инструмент менеджера, а не публичная выдача. Дверь закрыта
            аутентификацией, и каждое изменение попадает в журнал.
            """)
    record LeadRow(UUID id,

                   @Schema(description = "Номер заявки для людей: его называют по телефону.",
                           example = "З-2026-0042")
                   String number,

                   String form, String name, String company, String phone, String email,
                   String productSlug, String source, String status, String owner,

                   @Schema(description = "Сделка, в которую разобрана заявка. Пусто — заявка "
                           + "ещё не разобрана.", nullable = true)
                   UUID dealId,

                   Instant createdAt) {}

    @Schema(name = "AdminLead", description = "Заявка целиком, вместе с текстом и согласием.")
    record LeadView(UUID id,

                    @Schema(description = "Номер заявки для людей: его называют по телефону "
                            + "и пишут в письме. При обезличивании не стирается — он говорит, "
                            + "какая это заявка по счёту, а не кто её подал.",
                            example = "З-2026-0042")
                    String number,

                    String form, String name, String company, String phone, String email,
                    String productSlug,

                    @Schema(description = "Серийный номер изделия из сервисного обращения. "
                            + "Пусто — не указан. При обезличивании не стирается: это "
                            + "характеристика аппарата, а не человека.", nullable = true)
                    String serialNumber,

                    String message, String source, String status, String owner,

                    @Schema(description = "Язык страницы, с которой отправлена заявка. "
                            + "Разрез аналитики.", example = "ru", nullable = true)
                    String language,

                    @Schema(description = "Кампания, приведшая посетителя. Разрез аналитики.",
                            nullable = true)
                    String campaign,

                    @Schema(description = "Сделка, в которую разобрана заявка.", nullable = true)
                    UUID dealId,

                    @Schema(description = "Версия текста согласия, с которым человек согласился. "
                            + "Хранится версия, а не галочка: через год иначе не доказать, "
                            + "с чем именно он согласился.")
                    String consentVersion,
                    Instant consentAt,
                    @Schema(description = "Идентификатор цепочки запроса. По нему в журнале "
                            + "собирается весь путь заявки.", nullable = true)
                    String correlationId,

                    @Schema(description = "Когда персональные данные заявки уничтожены. "
                            + "Пусто — не уничтожались. Нужно интерфейсу, чтобы отличить "
                            + "исполненное обращение от сбоя: без этой отметки слово "
                            + "«удалено» в полях выглядит одинаково в обоих случаях.",
                            nullable = true)
                    Instant erasedAt,

                    Instant createdAt) {}

    @Schema(name = "AdminLeadTriage", description = "Разбор заявки: статус и ответственный.")
    record Triage(
            @Schema(allowableValues = {"draft", "new", "in_progress", "won", "lost"})
            @NotBlank String status,
            @Schema(description = "Логин ответственного. Пусто — снять ответственного.",
                    nullable = true)
            @Size(max = 200) String owner) {}

    @Schema(name = "AdminLeadFilter", description = """
            Отбор списка заявок. Все поля необязательны и складываются:
            заданные сужают выборку, пустые её не трогают.
            """)
    record Filter(
            @Schema(description = "Статус заявки. Пусто — все.", nullable = true)
            String status,

            @Schema(description = """
                    Поиск по имени, компании, телефону, почте и серийному номеру изделия.
                    Совпадение по части строки, регистр не важен. Телефон сравнивается
                    как записан: номер с пробелами по цифрам подряд не найдётся.
                    """, nullable = true)
            String query,

            @Schema(description = """
                    Логин ответственного. Значение «-» означает «без ответственного» —
                    это отдельный вопрос менеджера, а не отсутствие фильтра.
                    """, example = "-", nullable = true)
            String owner,

            @Schema(description = "Форма, с которой пришла заявка. Пусто — любая.",
                    nullable = true)
            String form,

            @Schema(description = "Источник перехода. Пусто — любой.", nullable = true)
            String source) {

        /** Пустая строка и строка из пробелов — это «фильтра нет», а не «пусто». */
        static String clean(String value) {
            return value == null || value.isBlank() ? null : value.trim();
        }

        // public обязателен: запись объявлена внутри интерфейса, а значит уже
        // публична, и компактный конструктор не может быть строже её самой.
        public Filter {
            status = clean(status);
            query = clean(query);
            owner = clean(owner);
            form = clean(form);
            source = clean(source);
        }
    }

    PageView<LeadRow> leads(Filter filter, int page, int size);

    LeadView lead(UUID id);

    LeadView triage(UUID id, Triage triage, String actor);
}
