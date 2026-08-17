package ru.vedal.portal.assistant;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "AskRequest", description = "Вопрос Урании.")
public record AskRequest(

        @Schema(description = "Текст вопроса. В журнал он не попадает: посетитель может указать "
                + "в нём и клинику, и себя.",
                example = "Какие каналы мониторинга у инкубатора-трансформера?",
                maxLength = 500, requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "Напишите вопрос")
        @Size(max = 500, message = "Вопрос слишком длинный, сформулируйте короче")
        String question
) {
}
