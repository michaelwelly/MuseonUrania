package ru.vedal.portal.gateway;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Обращение, заведённое прямо из разговора.
 *
 * <p><b>Почему не та же {@link LeadSubmission}.</b> Разница не в удобстве,
 * а в том, откуда берутся поля. Тип формы здесь не выбирают — обращение
 * из чата всегда консультация. Текст обращения не пишут — им становится
 * переписка, которая уже состоялась: заставлять человека пересказывать
 * в форме то, что он только что написал в чат, значит спрашивать дважды.
 * Изделие и серийный номер сюда не приходят вовсе.
 *
 * <p>А вот проверки контактов те же, и это не формальность: заявка без
 * телефона и почты — заявка, по которой некому ответить, независимо от того,
 * из какой двери она пришла.
 */
@Schema(name = "ChatLeadSubmission",
        description = """
                Контакты для обращения, заводимого из разговора. Тип формы, текст
                и изделие не передаются: форма всегда `consultation`, текстом
                становится переписка, изделия в разговоре может не быть вовсе.
                """)
public record ChatLeadSubmission(

        @Schema(description = """
                Ключ разговора в браузере — тот же, которым виджет читает ленту.
                По нему находится разговор, к которому привяжется заявка.
                """, example = "b1f0c2de-9a7e-4d21-8c33-0f2a5e6d7b48",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank @Size(max = 64) String visitorKey,

        @Schema(description = "Имя обращающегося.", example = "Ирина Петрова",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "Укажите, к кому обращаться")
        String name,

        @Schema(description = "Организация. Необязательно.",
                example = "Областной перинатальный центр")
        @Size(max = 200, message = "Название организации не длиннее 200 символов")
        String company,

        @Schema(description = "Телефон с кодом: не меньше десяти цифр, разделители любые.",
                example = "+7 343 300-00-00", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank
        @Pattern(regexp = "^(?:\\D*\\d){10,}\\D*$", message = "Укажите телефон с кодом")
        String phone,

        @Schema(description = "Адрес почты для ответа. На него уходит подтверждение "
                + "с номером обращения.",
                example = "i.petrova@example.ru", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank
        @Email(message = "Проверьте адрес почты")
        String email,

        @Schema(description = "Язык страницы: двухбуквенный код. Разрез аналитики.",
                allowableValues = {"ru", "en", "zh"}, example = "ru")
        @Pattern(regexp = "^$|^[a-zA-Z]{2}$", message = "Язык — двухбуквенный код")
        String language,

        @Schema(description = "Кампания, приведшая посетителя. Разрез аналитики.",
                example = "innoprom-2026", maxLength = 200)
        @Size(max = 200, message = "Название кампании не длиннее 200 символов")
        String campaign,

        @Schema(description = """
                Согласие на обработку персональных данных. Без `true` обращение
                не принимается.

                Спрашивается именно здесь, а не при первом сообщении в чат:
                до этого момента посетитель анонимен — ключ вкладки о человеке
                не сообщает ничего, — и согласие ему давать не на что. Форма
                «представьтесь» перед первым вопросом отсекала бы большую часть
                тех, кто хотел быстро спросить.
                """, example = "true", requiredMode = Schema.RequiredMode.REQUIRED)
        @AssertTrue(message = "Без согласия отправить обращение нельзя")
        boolean consent,

        @Schema(description = "Ловушка для ботов: поле скрыто в разметке и должно приходить "
                + "пустым. Заполненное — обращение отклоняется с `400`.", example = "")
        String trap
) {
}
