package ru.vedal.portal.assistant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AskRequest(

        @NotBlank(message = "Напишите вопрос")
        @Size(max = 500, message = "Вопрос слишком длинный, сформулируйте короче")
        String question
) {
}
