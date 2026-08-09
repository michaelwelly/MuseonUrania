package ru.vedal.portal.assistant;

import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

// Жёсткие ограничения из urania_assistant_spec.md. Живут здесь, а не в промпте:
// промпт — это просьба, а не гарантия. Вопрос, попавший под правило, до движка
// вообще не доходит.
@Component
public class Guardrails {

    // Причина отказа → как её объяснить посетителю. Формулировки спокойные:
    // ассистент не отчитывает, а передаёт человеку.
    private static final Map<Pattern, String> BLOCKED = new LinkedHashMap<>();

    static {
        BLOCKED.put(
                compile("диагноз", "диагностировать", "поставить\\s+диагноз", "симптом\\w*",
                        "чем\\s+лечить", "как\\s+лечить", "лечение", "терапи\\w+\\s+для\\s+пациент\\w*",
                        "дозировк\\w+", "показани\\w+\\s+к\\s+применению", "противопоказани\\w+"),
                "Я не даю медицинских заключений и не рекомендую лечение. "
                        + "По клиническим вопросам нужен специалист VEDAL или лечащий врач.");

        BLOCKED.put(
                compile("цена", "цены", "цену", "стоимость", "сколько\\s+стоит", "прайс\\w*",
                        "скидк\\w+", "коммерческ\\w+\\s+условия"),
                "Цены не публикуются: их рассчитывает специалист под конкретную комплектацию. "
                        + "Оставьте запрос на коммерческое предложение.");

        BLOCKED.put(
                compile("срок\\w*\\s+поставки", "когда\\s+привез\\w+", "когда\\s+доставит\\w+",
                        "есть\\s+в\\s+наличии", "наличие\\s+на\\s+складе", "когда\\s+отгруз\\w+"),
                "Сроки и наличие подтверждает специалист по конкретной заявке — я их не выдумываю.");
    }

    // Флаг обязательно U, а не u: строчная u — это UNICODE_CASE, она включает
    // только регистронезависимость для не-ASCII. Границу слова \b определяет
    // UNICODE_CHARACTER_CLASS, и без неё \b вокруг кириллицы не срабатывает —
    // правила молча не находят ни «диагноз», ни «сколько стоит».
    private static Pattern compile(String... alternatives) {
        return Pattern.compile("(?iU)\\b(" + String.join("|", alternatives) + ")\\b");
    }

    // Пустой Optional означает «вопрос можно передать движку».
    public Optional<String> refuse(String question) {
        if (question == null || question.isBlank()) {
            return Optional.of("Напишите вопрос — подскажу по продукции, документам или сервису.");
        }
        return BLOCKED.entrySet().stream()
                .filter(e -> e.getKey().matcher(question).find())
                .map(Map.Entry::getValue)
                .findFirst();
    }
}
