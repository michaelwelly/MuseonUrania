package ru.vedal.portal.assistant;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

// handoff заполнен, когда ответа нет: по правилу из спеки «если подходящих
// опубликованных источников нет — ответа нет, есть передача человеку».
@Schema(name = "AskReply",
        description = """
                Ответ Ведалины. Заполнено ровно одно из двух: либо `answer` со списком
                `sources`, либо `handoff` — тогда `sources` пуст.

                Ответа без источников не бывает: движок работает поверх опубликованного,
                и придумывать ответ, когда подходящих материалов нет, запрещено.
                """)
public record AskReply(

        @Schema(description = "Текст ответа. При передаче человеку сюда попадает причина — "
                + "тот же текст, что и в `handoff.reason`.")
        String answer,

        @Schema(description = "Материалы, на которых построен ответ. Пуст при передаче человеку.")
        List<LlmEngine.Source> sources,

        @Schema(description = "Передача специалисту. `null`, когда ответ дан.", nullable = true)
        Handoff handoff) {

    @Schema(name = "Handoff", description = "Куда обращаться, когда ассистент не отвечает.")
    public record Handoff(

            @Schema(description = "Почему ответа нет: вопрос отклонён ограничениями "
                    + "(диагноз, цена) или по опубликованному ничего не нашлось.")
            String reason,

            @Schema(description = "Телефон отдела продаж.", example = "8 800 600 3449")
            String phone,

            @Schema(description = "Почта отдела продаж.", example = "sales@vedal-med.ru")
            String email,

            @Schema(description = "Формы, которые уместно предложить вместо ответа.",
                    example = "[\"quote\", \"catalog\", \"consultation\", \"service\"]")
            List<String> forms) {}
}
