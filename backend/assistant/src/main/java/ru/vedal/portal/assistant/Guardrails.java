package ru.vedal.portal.assistant;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

// Жёсткие ограничения из urania_assistant_spec.md. Живут здесь, а не в промпте:
// промпт — это просьба, а не гарантия. Вопрос, попавший под правило, до движка
// вообще не доходит.
//
// ───────────────────────────────────────────────────────────────────────────
// Три языка, и это не украшение
//
// Правила были русскими регулярками. Замер на стенде 7 сентября:
// «Сколько стоит VEDAL A-2000?» получал ответ про расчёт под комплектацию
// и приглашение оставить запрос на КП, а «How much does the VEDAL A-2000
// cost?» уходил мимо правил — до модели, и та отвечала «в опубликованных
// материалах этого нет». Цену она не выдумала, но и человек не узнал,
// что цену считают под комплектацию и что можно запросить КП.
//
// Хуже того, надёжность держалась на промпте: правило не сработало, и всё,
// что стояло между вопросом о цене и выдуманным числом, — просьба к модели
// не выдумывать. Ради этого правила и вынесены из промпта.
//
// Отвечаем на языке вопроса. Русский отказ на английский вопрос — это
// «мы вас не поняли», сказанное вежливыми словами.
@Component
public class Guardrails {

    /** На каком языке спросили — на таком и отвечаем. */
    private enum Speech { RU, EN, ZH }

    /**
     * Одно ограничение: чем ловится и что отвечаем на каждом языке.
     *
     * <p>Ловушек две. {@code words} — с границами слов, для языков, где слова
     * разделены пробелами. {@code marks} — без границ, для китайского: там
     * пробелов нет, и {@code \b} не находит ничего.
     */
    private record Rule(Pattern words, Pattern marks, String ru, String en, String zh) {

        boolean matches(String question) {
            return words.matcher(question).find()
                    || (marks != null && marks.matcher(question).find());
        }

        String answer(Speech speech) {
            return switch (speech) {
                case RU -> ru;
                case EN -> en;
                case ZH -> zh;
            };
        }
    }

    private static final String CLINICAL_RU =
            "Я не даю медицинских заключений и не рекомендую лечение. "
                    + "По клиническим вопросам нужен специалист VEDAL или лечащий врач.";
    private static final String CLINICAL_EN =
            "I do not give medical conclusions and do not recommend treatment. "
                    + "Clinical questions need a VEDAL specialist or the attending physician.";
    private static final String CLINICAL_ZH =
            "我不提供医疗结论，也不建议治疗方案。临床问题请咨询 VEDAL 专家或主治医生。";

    private static final List<Rule> BLOCKED = List.of(
            new Rule(
                    words("диагноз", "диагностировать", "поставить\\s+диагноз", "симптом\\w*",
                            "чем\\s+лечить", "как\\s+лечить", "лечение",
                            "терапи\\w+\\s+для\\s+пациент\\w*", "дозировк\\w+",
                            "показани\\w+\\s+к\\s+применению", "противопоказани\\w+",
                            "diagnos\\w*", "symptom\\w*", "treat(ment|ing)?", "therapy",
                            "dosage", "contraindication\\w*", "prescri\\w+"),
                    marks("诊断", "症状", "治疗", "剂量", "禁忌"),
                    CLINICAL_RU, CLINICAL_EN, CLINICAL_ZH),

            new Rule(
                    words("цена", "цены", "цену", "стоимость", "сколько\\s+стоит", "прайс\\w*",
                            "скидк\\w+", "коммерческ\\w+\\s+условия",
                            "price\\w*", "cost\\w*", "how\\s+much", "quotation", "discount\\w*",
                            "pricing"),
                    marks("价格", "多少钱", "报价", "折扣"),
                    "Цены не публикуются: их рассчитывает специалист под конкретную комплектацию. "
                            + "Оставьте запрос на коммерческое предложение.",
                    "Prices are not published: a specialist calculates them for the exact "
                            + "configuration. Leave a request and we will send a quotation.",
                    "我们不公开价格：专家会根据具体配置进行计算。请留下询价请求，我们会发送报价。"),

            new Rule(
                    words("срок\\w*\\s+поставки", "когда\\s+привез\\w+", "когда\\s+доставит\\w+",
                            "есть\\s+в\\s+наличии", "наличие\\s+на\\s+складе", "когда\\s+отгруз\\w+",
                            "delivery\\s+(time|date|term\\w*)", "lead\\s+time", "in\\s+stock",
                            "availability", "when\\s+can\\s+you\\s+(deliver|ship)", "shipping\\s+time"),
                    marks("交货", "供货", "库存", "发货"),
                    "Сроки и наличие подтверждает специалист по конкретной заявке — я их не выдумываю.",
                    "Delivery dates and availability are confirmed by a specialist for a specific "
                            + "request — I do not invent them.",
                    "交货时间和库存由专家根据具体请求确认，我不会自行猜测。"));

    // Острое состояние человека. Эти слова не встречаются в вопросе про изделие:
    // «не дышит» и «судороги» описывают человека, а не инкубатор, поэтому
    // достаточно одного совпадения.
    private static final Pattern ACUTE = words(
            "не\\s+дыш\\w*", "не\\s+реагиру\\w*", "посинел\\w*", "синеет", "цианоз",
            "судорог\\w*", "апноэ", "асфикси\\w+", "гипокси\\w+", "гипотерми\\w+",
            "гипертерми\\w+", "задыха\\w+", "умира\\w+", "без\\s+сознания",
            "потерял\\w*\\s+сознание", "остановк\\w+\\s+сердца", "реанимировать",
            "not\\s+breathing", "stopped\\s+breathing", "unconscious", "seizure\\w*",
            "cyanosis", "turning\\s+blue", "apnea", "asphyxia", "hypoxia",
            "hypothermia", "hyperthermia", "cardiac\\s+arrest", "dying");

    private static final Pattern ACUTE_MARKS = marks("窒息", "抽搐", "昏迷", "呼吸停止");

    // Показатели живого человека. Порознь ни одно из двух не признак:
    // «температура» стоит в описании каждого инкубатора, а «новорождённый» —
    // в названии половины каталога. Признаком становится сочетание.
    //
    // Разделяет их предлог «у»: так говорят о человеке, а не об изделии.
    // «У новорождённого температура 35» — это состояние ребёнка;
    // «инкубатор держит температуру 36» — это характеристика.
    private static final Pattern PERSON = words(
            "у\\s+(ребёнк\\w*|ребенк\\w*|новорождённ\\w*|новорожденн\\w*|младен\\w*"
                    + "|пациент\\w*|недоношенн\\w*|малыш\\w*|дочк\\w*|сын\\w*)",
            "my\\s+(baby|child|son|daughter|newborn)",
            "the\\s+(baby|newborn|infant|patient)\\s+(has|is)");
    private static final Pattern VITALS = words(
            "температур\\w*", "пульс\\w*", "давлени\\w+", "сатураци\\w+",
            "дыхани\\w+", "состояни\\w+", "вес", "сердцебиени\\w+",
            "temperature", "pulse", "saturation", "breathing", "heart\\s*rate", "weight");

    /**
     * Флаг обязательно U, а не u: строчная u — это UNICODE_CASE, она включает
     * только регистронезависимость для не-ASCII. Границу слова {@code \b}
     * определяет UNICODE_CHARACTER_CLASS, и без неё {@code \b} вокруг кириллицы
     * не срабатывает — правила молча не находят ни «диагноз», ни «сколько стоит».
     */
    private static Pattern words(String... alternatives) {
        return Pattern.compile("(?iU)\\b(" + String.join("|", alternatives) + ")\\b");
    }

    /**
     * То же самое, но без границ слова.
     *
     * <p>В китайском пробелов между словами нет, и {@code \b} там не находит
     * ничего: «多少钱» внутри фразы для регулярки не «слово». Поэтому иероглифы
     * ищутся подстрокой — ложных срабатываний это не даёт, сочетания вроде
     * «价格» в русском или английском тексте не встречаются.
     */
    private static Pattern marks(String... alternatives) {
        return Pattern.compile("(" + String.join("|", alternatives) + ")");
    }

    /**
     * Язык вопроса — по письменности, а не по словарю.
     *
     * <p>Кириллица решает первой: «Сколько стоит VEDAL A-2000?» содержит
     * и латиницу, но спрашивают по-русски. Иероглифы — второй признак.
     * Всё остальное считается английским: это язык, на котором к нам придёт
     * иностранный клиент, даже если родной у него другой.
     */
    private static Speech speechOf(String question) {
        if (question.codePoints().anyMatch(Guardrails::cyrillic)) return Speech.RU;
        if (question.codePoints().anyMatch(Guardrails::chinese)) return Speech.ZH;
        return Speech.EN;
    }

    private static boolean cyrillic(int codePoint) {
        return Character.UnicodeBlock.of(codePoint) == Character.UnicodeBlock.CYRILLIC;
    }

    private static boolean chinese(int codePoint) {
        var block = Character.UnicodeBlock.of(codePoint);
        return block == Character.UnicodeBlock.CJK_UNIFIED_IDEOGRAPHS
                || block == Character.UnicodeBlock.CJK_UNIFIED_IDEOGRAPHS_EXTENSION_A;
    }

    // Пустой Optional означает «вопрос можно передать движку».
    public Optional<String> refuse(String question) {
        if (question == null || question.isBlank()) {
            return Optional.of("Напишите вопрос — подскажу по продукции, документам или сервису.");
        }

        var speech = speechOf(question);

        // Клиническая ситуация проверяется до списка слов.
        //
        // Что было. Правила ловили лексику врача — «диагноз», «симптом»,
        // «чем лечить». Речь испуганного родителя мимо них проходила, и вопрос
        // уходил в поиск. Замер на стенде: «У новорождённого температура
        // 35 градусов, что делать?» — ассистент отвечал подбором инкубатора.
        //
        // Хуже всего именно этот случай: слово «температура» есть и у
        // переохлаждённого младенца, и у терморегулирующей системы, поэтому
        // поиск находил товар и выдавал его как ответ. Вопросы без такого
        // пересечения («ребёнок не дышит») спасала пустая выдача — но
        // спасала случайно, а не по правилу.
        //
        // Перекос допущен намеренно: ошибочный отказ стоит передачи человеку,
        // ошибочный ответ — предложения купить инкубатор тому, кто описывает
        // состояние ребёнка.
        if (ACUTE.matcher(question).find()
                || ACUTE_MARKS.matcher(question).find()
                || (PERSON.matcher(question).find() && VITALS.matcher(question).find())) {
            return Optional.of(switch (speech) {
                case RU -> CLINICAL_RU;
                case EN -> CLINICAL_EN;
                case ZH -> CLINICAL_ZH;
            });
        }

        return BLOCKED.stream()
                .filter(rule -> rule.matches(question))
                .map(rule -> rule.answer(speech))
                .findFirst();
    }
}
