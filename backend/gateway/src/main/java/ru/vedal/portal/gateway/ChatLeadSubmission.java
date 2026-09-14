package ru.vedal.portal.gateway;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Explicitly provided contacts and consent for a conversation handoff. */
@Schema(name = "ChatLeadSubmission", description = """
        Контакты для обращения из разговора. Форма — consultation, переписку
        прикладывает сервер. Для callback=true почта необязательна; телефон
        и явное согласие обязательны. Изделие и причина — со слов посетителя.
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
        @Size(max = 200) String name,

        @Schema(description = "Организация. Необязательно.",
                example = "Областной перинатальный центр")
        @Size(max = 200, message = "Название организации не длиннее 200 символов")
        String company,

        @Schema(description = "Телефон с кодом: не меньше десяти цифр, разделители любые.",
                example = "+7 343 300-00-00", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank
        @Pattern(regexp = "^(?:\\D*\\d){10,}\\D*$", message = "Укажите телефон с кодом")
        @Size(max = 100) String phone,

        @Schema(description = "Адрес почты для ответа. На него уходит подтверждение "
                + "с номером обращения.",
                example = "i.petrova@example.ru")
        @Email(message = "Проверьте адрес почты")
        @Size(max = 254) String email,

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
        String trap,

        Boolean callback,
        @Size(max = 500) String reason,
        @Size(max = 128) @Pattern(regexp = "^[a-z0-9-]*$") String productSlug
) {
    @AssertTrue(message = "Укажите почту для обращения")
    public boolean isEmailProvided() {
        return callbackRequested() || (email != null && !email.isBlank());
    }

    public boolean callbackRequested() {
        return Boolean.TRUE.equals(callback);
    }
}
