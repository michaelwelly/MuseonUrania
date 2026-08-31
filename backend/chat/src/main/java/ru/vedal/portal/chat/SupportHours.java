package ru.vedal.portal.chat;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Часы, в которые в чате отвечают люди.
 *
 * <p><b>Зачем это порталу, если присутствие и так видно.</b> Видно ровно одно:
 * открыто ли сейчас хоть одно рабочее место. Этого хватает, чтобы сказать
 * «на связи», и не хватает, чтобы сказать «приходите завтра»: посетителю,
 * пишущему в полночь, нужно знать не только что никого нет, но и когда
 * появятся. Без этого «сейчас никого нет» читается как «здесь никого
 * не бывает».
 *
 * <p><b>Почему настройками, а не таблицей с редактором в админке.</b>
 * Расписание меняется реже, чем раз в релиз, а таблица требует экрана,
 * прав, журнала правок и решения, что делать с праздниками. Заводить всё это
 * ради двух значений — работа, которая окупится тогда, когда расписание
 * станет сложным; сейчас оно проще некуда.
 *
 * <p><b>Откуда взяты значения по умолчанию.</b> «Пн–Пт 9:00–18:00» — часы
 * отдела продаж, уже опубликованные на сайте (`site.phoneHours`), и зона
 * Екатеринбурга — по адресу из реквизитов. Это не выдумка про поддержку,
 * а перенос подтверждённого: чат отвечают те же люди и в те же часы.
 * Разойдутся — правится настройкой, а не кодом.
 *
 * <p><b>Чего здесь нет.</b> Праздников и переносов. Календарь рабочих дней —
 * это внешний источник, который надо откуда-то брать и поддерживать;
 * ошибиться в нём легко, а цена ошибки — «мы работаем» в день, когда
 * никто не ответит. Пока праздник выглядит как обычный день, в который
 * никого нет на связи, — и посетитель это увидит по факту присутствия,
 * а не по обещанию.
 */
@Component
public class SupportHours {

    private final Set<DayOfWeek> days;
    private final LocalTime opens;
    private final LocalTime closes;
    private final ZoneId zone;
    private final String description;

    public SupportHours(
            @Value("${vedal.support.days:MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY}") String days,
            @Value("${vedal.support.opens:09:00}") String opens,
            @Value("${vedal.support.closes:18:00}") String closes,
            @Value("${vedal.support.zone:Asia/Yekaterinburg}") String zone,
            @Value("${vedal.support.description:Пн–Пт 9:00–18:00 (Екатеринбург)}") String description) {

        this.days = Arrays.stream(days.split(","))
                .map(String::trim)
                .filter(day -> !day.isBlank())
                .map(day -> DayOfWeek.valueOf(day.toUpperCase(Locale.ROOT)))
                .collect(Collectors.toUnmodifiableSet());
        this.opens = LocalTime.parse(opens);
        this.closes = LocalTime.parse(closes);
        this.zone = ZoneId.of(zone);
        this.description = description;
    }

    /**
     * Рабочее ли сейчас время.
     *
     * <p>Считается в зоне поддержки, а не в зоне сервера и не в зоне
     * посетителя. Сервер может стоять где угодно — это деталь размещения,
     * а не свойство расписания; посетитель может писать из любого часового
     * пояса, и «у него ещё день» ничего не говорит о том, есть ли кто-то
     * на месте.
     */
    public boolean openNow() {
        return openAt(ZonedDateTime.now(zone));
    }

    /** То же, но в заданный момент, — чтобы это можно было проверить тестом. */
    boolean openAt(ZonedDateTime moment) {
        var local = moment.withZoneSameInstant(zone);
        if (!days.contains(local.getDayOfWeek())) return false;

        var time = local.toLocalTime();
        // Граница закрытия строгая: в 18:00 уже не работают. Открытия —
        // нестрогая: в 9:00 уже работают.
        return !time.isBefore(opens) && time.isBefore(closes);
    }

    /**
     * Часы работы одной строкой — для показа посетителю.
     *
     * <p>Готовая строка, а не три поля, которые виджет соберёт сам: расписание
     * пишут словами («Пн–Пт 9:00–18:00»), и собирать их из дней недели значит
     * получить в интерфейсе перечисление из пяти слов. Разойдутся строка
     * и границы — увидим на первом же вопросе «а почему написано одно,
     * а отвечают в другое»; поэтому и то и другое живёт в одном месте,
     * в настройках рядом.
     */
    public String description() {
        return description;
    }
}
