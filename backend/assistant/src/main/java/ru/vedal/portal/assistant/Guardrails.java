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
     * Отказ и то, нужен ли после него живой человек.
     *
     * <p><b>Зачем флаг.</b> Раньше любой отказ ставил разговор в очередь
     * к специалисту, и очередь на стенде выглядела так, будто ассистента
     * нет вовсе: страница за страницей передач, включая пустые сообщения.
     * Очередь, куда падает всё, равна отсутствию очереди — дежурный
     * перестаёт её читать, и настоящее обращение тонет среди «привет»
     * и «расскажи про погоду».
     *
     * <p>Человек нужен там, где он действительно продолжает разговор:
     * цена, сроки, наличие, статус регистрации, клинический вопрос, жалоба
     * и прямая просьба позвать живого. Пустое сообщение к таким не
     * относится: звать по нему специалиста — то же самое, что звать его
     * по нажатой случайно клавише.
     *
     * @param answer что говорит Ведалина;
     * @param human  ставить ли разговор в очередь к специалисту.
     */
    public record Refusal(String answer, boolean human) {}

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
                            + "Дальше так: напишите здесь модель и задачу отделения — я передам "
                            + "специалисту, и он подготовит коммерческое предложение. Можно и "
                            + "оставить запрос формой на сайте: у обращения будет номер, "
                            + "и ответ придёт на почту. А про сами изделия я расскажу сразу — "
                            + "спрашивайте.",
                    "Prices are not published: a specialist calculates them for the exact "
                            + "configuration. Here is what happens next: name the model and the "
                            + "task of your unit here, and I will pass it to a specialist who "
                            + "will prepare a quotation. You can also leave a request on the "
                            + "site — it gets a number and the answer comes by email. About the "
                            + "products themselves I can tell you right away, just ask.",
                    "我们不公开价格：专家会根据具体配置进行计算。"
                            + "接下来这样做：请在此写明型号和科室的任务，我会转交专家，由他准备报价。"
                            + "也可以在网站上留下请求——请求会有编号，答复将发送到您的邮箱。"
                            + "至于产品本身，我可以立即为您介绍，请随时提问。"),

            new Rule(
                    // «Когда поставите R2» мимо этого списка проходило:
                    // ловилось «срок поставки» и «когда привезёте», а самая
                    // частая форма вопроса — глагол «поставите» — нет.
                    // Замер на стенде 9 сентября: вопрос уходил в поиск,
                    // ничего не находил и кончался «нет материалов».
                    words("срок\\w*\\s+постав\\w+", "когда\\s+привез\\w+", "когда\\s+доставит\\w+",
                            "когда\\s+постав\\w+", "когда\\s+отправ\\w+",
                            "когда\\s+будет\\s+готов\\w*",
                            "есть\\s+в\\s+наличии", "наличие\\s+на\\s+складе", "когда\\s+отгруз\\w+",
                            "delivery\\s+(time|date|term\\w*)", "lead\\s+time", "in\\s+stock",
                            "availability", "when\\s+can\\s+you\\s+(deliver|ship)", "shipping\\s+time"),
                    marks("交货", "供货", "库存", "发货"),
                    "Сроки и наличие подтверждает специалист по конкретной заявке — я их "
                            + "не выдумываю. Напишите здесь модель и количество, я передам "
                            + "специалисту, и он ответит в этом же окне; можно и оставить "
                            + "обращение формой на сайте — тогда ответ придёт на почту.",
                    "Delivery dates and availability are confirmed by a specialist for a specific "
                            + "request — I do not invent them. Name the model and the quantity "
                            + "here: I will pass it to a specialist and he will answer in this "
                            + "window, or leave a request on the site and the answer will come "
                            + "by email.",
                    "交货时间和库存由专家根据具体请求确认，我不会自行猜测。"
                            + "请在此写明型号和数量，我会转交专家，他会在本窗口回复；"
                            + "也可以在网站上留下请求，答复将发送到您的邮箱。"),

            // ————— статус регистрации и сертификации —————
            //
            // Правило проекта — «не выдумывать сертификаты и статус
            // регистрации», и это единственное правило, которое обходится
            // не выдумкой, а пересказом. Строка перечня «Регистрационное
            // удостоверение — VEDAL R1, R2» на вопрос «есть ли у вас
            // регистрационное удостоверение» читается как «да, есть»,
            // хотя у неё стоит статус «наличие уточняется».
            //
            // Поэтому вопрос о НАЛИЧИИ разрешительного документа отвечается
            // здесь и одинаково, а сам перечень остаётся доступен обычным
            // путём: «какие документы есть по VEDAL A-2000» под это правило
            // не подходит и по-прежнему отвечается перечнем со статусами.
            new Rule(
                    words("есть\\s+ли\\s+(у\\s+вас\\s+)?(регистрационн\\w+|сертификат\\w*"
                                    + "|лицензи\\w+|удостоверени\\w+|разрешени\\w+)",
                            "сертифицирован\\w*", "зарегистрирован\\w*",
                            "статус\\w*\\s+регистрации", "росздравнадзор\\w*",
                            "регистрационн\\w+\\s+удостоверени\\w+",
                            "is\\s+it\\s+(registered|certified)",
                            "do\\s+you\\s+have\\s+(a\\s+)?"
                                    + "(registration|certificate|licence|license)",
                            "registration\\s+certificate"),
                    marks("注册证", "认证", "许可证"),
                    "Наличие и статус разрешительных документов я не подтверждаю: это утверждение "
                            + "о регистрации медицинского изделия, и его даёт специалист, а не "
                            + "ассистент. В разделе «Документы» на сайте у каждой строки указан "
                            + "статус — файл, по запросу или уточняется. Назовите модель: покажу, "
                            + "что стоит в перечне, и передам вопрос специалисту.",
                    "I do not confirm whether a permit document exists or what its status is: "
                            + "that is a statement about the registration of a medical device, "
                            + "and a specialist makes it, not an assistant. The «Documents» "
                            + "section lists the status of every entry — file, on request, "
                            + "or being clarified. Name the model: I will show what the listing "
                            + "has and pass the question to a specialist.",
                    "我不确认许可文件是否存在及其状态：这是关于医疗器械注册的声明，"
                            + "应由专家而非助手作出。网站「文件」栏目中每一条都标注了状态——"
                            + "文件、按请求提供或正在确认。请告知型号：我会显示清单中的内容，"
                            + "并把问题转交专家。"));

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

    /**
     * Человека попросили словами, а не кнопкой.
     *
     * <p>Кнопка «Позвать специалиста» в виджете есть, но нажимают её не все:
     * половина пишет «позовите живого человека» в поле ввода. До этого
     * правила такая просьба уходила в поиск по опубликованному, ничего
     * не находила и попадала к человеку случайно — тем же путём, что вопрос
     * про погоду. Человека получал тот, кому не повезло, а не тот, кто
     * его просил.
     *
     * <p>Жалоба здесь по той же причине: разбирать претензию ассистент
     * не должен ни при каком качестве поиска.
     */
    private static final Pattern HUMAN = words(
            "живо\\w*\\s+человек\\w*", "с\\s+человеком", "позов\\w+\\s+(специалист\\w*|человек\\w*"
                    + "|менеджер\\w*|сотрудник\\w*)",
            "соедин\\w+\\s+(с\\s+)?(специалист\\w*|человек\\w*|менеджер\\w*|сотрудник\\w*)",
            "(хочу|нужен|нужно|можно)\\s+(поговорить\\s+)?(с\\s+)?"
                    + "(специалист\\w*|человек\\w*|менеджер\\w*|оператор\\w*|сотрудник\\w*)",
            "жалоб\\w+", "претензи\\w+", "пожаловат\\w+",
            "real\\s+(person|human)", "talk\\s+to\\s+(a\\s+)?(human|person|manager|specialist)",
            "human\\s+(agent|support)", "speak\\s+to\\s+(a\\s+)?(human|manager|specialist)",
            "complaint");

    private static final Pattern HUMAN_MARKS = marks("投诉", "人工", "真人");

    private static final String HUMAN_RU =
            "Зову специалиста VEDAL — разговор встал в очередь, ответ придёт в это же окно. "
                    + "Опишите задачу здесь, чтобы специалисту не пришлось переспрашивать.";
    private static final String HUMAN_EN =
            "I am calling a VEDAL specialist — the conversation is queued and the answer will "
                    + "come to this same window. Describe the task here so that the specialist "
                    + "does not have to ask again.";
    private static final String HUMAN_ZH =
            "正在呼叫 VEDAL 专家——对话已进入队列，答复将出现在本窗口。"
                    + "请在此描述您的问题，以免专家再次询问。";

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

    /**
     * «Материалов нет» — на языке вопроса.
     *
     * <p>Живёт здесь, а не в {@code AssistantService}, по той же причине,
     * по какой здесь живут отказы ограничений: язык вопроса определяется
     * письменностью, и определение это одно на весь ассистент. Второе место,
     * где выбирают язык, — второй способ ошибиться.
     *
     * <p>Поймано на прогоне сценария показа 8 сентября. Вопрос
     * «Do you have neonatal incubators?» получал ответ по-русски: язык
     * определялся правильно, но текст «нет согласованных материалов» стоял
     * в сервисе одной русской строкой мимо всей этой механики. Хуже места
     * не придумать — это ровно тот ответ, который видит иностранный
     * посетитель, потому что материалы у нас русские и найти по его вопросу
     * нечего.
     */
    public String notFound(String question) {
        return switch (speechOf(question)) {
            case RU -> NOT_FOUND_RU;
            case EN -> NOT_FOUND_EN;
            case ZH -> NOT_FOUND_ZH;
        };
    }

    // Формулировка переписана 9 сентября. Прежняя начиналась с «выдумывать
    // я не стану» и кончалась «передам специалисту» — то есть говорила
    // только о том, чего Ведалина не сделает, и обрывала разговор передачей.
    // Владелец портала прочитал её как отписку, и он прав: человек пришёл
    // спросить, а получил объяснение, почему ему не ответят.
    //
    // Теперь сказано, что она УМЕЕТ. Перечислено не «вообще», а по разделам
    // сайта — это ровно те материалы, которые у неё есть, и обещание
    // выполнимое. Передача человеку осталась, но по просьбе, а не сама
    // собой: очередь, куда падает каждый ненайденный вопрос, дежурный
    // перестаёт читать.
    private static final String NOT_FOUND_RU =
            "Такого в опубликованных материалах VEDAL нет, а придумывать ответ я не буду. "
                    + "Зато могу рассказать о компании и производстве, показать каталог — "
                    + "инкубаторы, открытые реанимационные системы, терморегуляция, — найти "
                    + "документ в перечне со статусом доступа и подсказать, как оставить "
                    + "обращение. Назовите модель или задачу отделения. "
                    + "Нужен живой специалист — напишите об этом, и я передам разговор.";

    private static final String NOT_FOUND_EN =
            "VEDAL has nothing published on this, and I will not invent an answer. "
                    + "What I can do: tell you about the company and the production site, show "
                    + "the catalogue — incubators, open resuscitation systems, thermoregulation "
                    + "— find a document in the listing together with its access status, and "
                    + "explain how to leave a request. Name the model or the task of your unit. "
                    + "If you need a live specialist, say so and I will pass the conversation on.";

    private static final String NOT_FOUND_ZH =
            "关于这个问题，VEDAL 没有已公开的资料，我也不会凭空编造。"
                    + "我可以介绍公司和生产基地，展示产品目录——婴儿培养箱、"
                    + "开放式复苏系统、体温调节，在文件清单中查找文件并说明其获取状态，"
                    + "还可以告诉您如何提交请求。请说明型号或科室的任务。"
                    + "如果需要真人专家，请告诉我，我会转交对话。";

    // Пустой Optional означает «вопрос можно передать движку».
    public Optional<Refusal> refuse(String question) {
        // Пустое сообщение специалиста не требует. До правки требовало:
        // отказ ставил разговор в очередь наравне с вопросом про цену,
        // и дежурный получал разговор, в котором никто ничего не спросил.
        if (question == null || question.isBlank()) {
            return Optional.of(new Refusal(
                    "Напишите вопрос — подскажу по продукции, документам или сервису.", false));
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
            return Optional.of(new Refusal(switch (speech) {
                case RU -> CLINICAL_RU;
                case EN -> CLINICAL_EN;
                case ZH -> CLINICAL_ZH;
            }, true));
        }

        // Просьба позвать человека и жалоба — раньше списка слов, но позже
        // клиники. Позже клиники потому, что «позовите человека, у ребёнка
        // судороги» — это прежде всего описание состояния ребёнка. Раньше
        // списка потому, что «хочу поговорить с человеком про цену» —
        // это просьба о человеке, а не вопрос о цене, и отвечать на неё
        // справкой про расчёт комплектации значит не услышать сказанного.
        if (HUMAN.matcher(question).find() || HUMAN_MARKS.matcher(question).find()) {
            return Optional.of(new Refusal(switch (speech) {
                case RU -> HUMAN_RU;
                case EN -> HUMAN_EN;
                case ZH -> HUMAN_ZH;
            }, true));
        }

        // Все правила списка означают «дальше отвечает человек»: цена,
        // сроки, наличие и статус регистрации — ровно те вопросы,
        // по которым специалист действительно продолжает разговор.
        return BLOCKED.stream()
                .filter(rule -> rule.matches(question))
                .map(rule -> new Refusal(rule.answer(speech), true))
                .findFirst();
    }
}
