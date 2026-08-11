package ru.vedal.portal.assistant;

import java.util.List;

// handoff заполнен, когда ответа нет: по правилу из спеки «если подходящих
// опубликованных источников нет — ответа нет, есть передача человеку».
public record AskReply(String answer,
                       List<LlmEngine.Source> sources,
                       Handoff handoff) {

    public record Handoff(String reason, String phone, String email, List<String> forms) {}
}
