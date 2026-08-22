package ru.vedal.portal.gateway;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

// Проверки повторяют frontend/components/LeadForm.tsx намеренно: валидация на
// границе доверия нужна независимо от того, что проверил браузер.
@Schema(name = "LeadSubmission",
        description = """
                Заявка с сайта. Один формат на все пять форм — они отличаются полем `form`
                и тем, какие поля показывает интерфейс; проверки на сервере одинаковые.

                Отказ по проверкам приходит как `400` с разбором по полям в расширении
                `fields`, чтобы форма показала ошибку рядом с полем.
                """)
public record LeadSubmission(

        @Schema(description = """
                Какая форма отправлена: `quote` — запрос цены, `catalog` — запрос каталога,
                `consultation` — консультация, `service` — обращение в сервис,
                `partner` — партнёрство.""",
                allowableValues = {"quote", "catalog", "consultation", "service", "partner"},
                example = "quote", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank
        @Pattern(regexp = "quote|catalog|consultation|service|partner",
                message = "Неизвестный тип формы")
        String form,

        @Schema(description = "Имя обращающегося.", example = "Ирина Петрова",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "Укажите, к кому обращаться")
        String name,

        @Schema(description = "Организация. Необязательно.",
                example = "Областной перинатальный центр")
        String company,

        @Schema(description = "Телефон с кодом: не меньше десяти цифр, разделители любые.",
                example = "+7 343 300-00-00", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank
        @Pattern(regexp = "^(?:\\D*\\d){10,}\\D*$", message = "Укажите телефон с кодом")
        String phone,

        @Schema(description = "Адрес почты для ответа.", example = "i.petrova@example.ru",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank
        @Email(message = "Проверьте адрес почты")
        String email,

        @Schema(description = "Изделие, из карточки которого отправлена заявка. Необязательно.",
                example = "vedal-r1-r2")
        String productSlug,

        @Schema(description = """
                Серийный номер изделия. Показывается только в сервисной форме: в запросе
                цены или каталога изделия у человека ещё нет. Необязателен — номер знают
                не всегда, и обращение без него принимается как обычное.

                Формат не проверяется намеренно: вид серийного номера VEDAL в согласованных
                материалах не описан, а проверка по придуманной маске отклоняла бы
                настоящие номера. Ограничена только длина.""",
                example = "R2-2026-00417", maxLength = 100)
        @Size(max = 100, message = "Серийный номер не длиннее 100 символов")
        String serialNumber,

        @Schema(description = "Текст обращения, не короче десяти символов.",
                example = "Интересует поставка двух систем R2 и сроки изготовления.",
                minLength = 10, requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank
        @Size(min = 10, message = "Опишите обращение хотя бы одной фразой")
        String message,

        @Schema(description = """
                Язык страницы, с которой отправлена заявка: двухбуквенный код. Разрез
                аналитики — без него «по языку» посчитать нечем. Необязателен: заявка
                без него принимается и попадает в отчёт строкой «—».""",
                allowableValues = {"ru", "en", "zh"}, example = "ru")
        @Pattern(regexp = "^$|^[a-zA-Z]{2}$", message = "Язык — двухбуквенный код")
        String language,

        @Schema(description = "Кампания, приведшая посетителя: `utm_campaign` или её аналог. "
                + "Разрез аналитики, необязателен.",
                example = "innoprom-2026", maxLength = 200)
        @Size(max = 200, message = "Название кампании не длиннее 200 символов")
        String campaign,

        @Schema(description = "Согласие на обработку персональных данных. Без `true` заявка "
                + "не принимается. В заявке сохраняется версия текста согласия, а не сама галочка.",
                example = "true", requiredMode = Schema.RequiredMode.REQUIRED)
        @AssertTrue(message = "Без согласия отправить запрос нельзя")
        boolean consent,

        // Ловушка для ботов: поле скрыто в разметке, человек его не заполняет.
        @Schema(description = "Ловушка для ботов: поле скрыто в разметке и должно приходить "
                + "пустым. Заполненное — заявка отклоняется с `400`.", example = "")
        String trap
) {
}
