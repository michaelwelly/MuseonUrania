package ru.vedal.portal.gateway;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

// Проверки повторяют frontend/components/LeadForm.tsx намеренно: валидация на
// границе доверия нужна независимо от того, что проверил браузер.
public record LeadSubmission(

        @NotBlank
        @Pattern(regexp = "quote|catalog|consultation|service|partner",
                message = "Неизвестный тип формы")
        String form,

        @NotBlank(message = "Укажите, к кому обращаться")
        String name,

        String company,

        @NotBlank
        @Pattern(regexp = "^(?:\\D*\\d){10,}\\D*$", message = "Укажите телефон с кодом")
        String phone,

        @NotBlank
        @Email(message = "Проверьте адрес почты")
        String email,

        String productSlug,

        @NotBlank
        @Size(min = 10, message = "Опишите обращение хотя бы одной фразой")
        String message,

        @AssertTrue(message = "Без согласия отправить запрос нельзя")
        boolean consent,

        // Ловушка для ботов: поле скрыто в разметке, человек его не заполняет.
        String trap
) {
}
