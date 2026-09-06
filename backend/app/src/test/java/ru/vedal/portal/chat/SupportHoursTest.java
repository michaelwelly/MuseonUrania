package ru.vedal.portal.chat;

import org.junit.jupiter.api.Test;

import java.time.ZoneId;
import java.time.ZonedDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Часы, в которые в чате отвечают люди.
 *
 * <p>Без Spring: это расписание, а не служба портала. Момент времени
 * передаётся снаружи — привязка к «сейчас» сделала бы тест зелёным
 * до вечера пятницы и красным в субботу.
 */
class SupportHoursTest {

    private static final ZoneId EKB = ZoneId.of("Asia/Yekaterinburg");

    private static SupportHours рабочиеДни() {
        return new SupportHours("MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY",
                "09:00", "18:00", "Asia/Yekaterinburg", "Пн–Пт 9:00–18:00 (Екатеринбург)");
    }

    private static ZonedDateTime вЕкатеринбурге(int день, int час) {
        // Август 2026: 3-е — понедельник, 8-е — суббота.
        return ZonedDateTime.of(2026, 8, день, час, 0, 0, 0, EKB);
    }

    @Test
    void middayOnAWeekdayIsWorkingTime() {
        assertThat(рабочиеДни().openAt(вЕкатеринбурге(3, 12))).isTrue();
    }

    @Test
    void nightIsNot() {
        assertThat(рабочиеДни().openAt(вЕкатеринбурге(3, 23))).isFalse();
        assertThat(рабочиеДни().openAt(вЕкатеринбурге(3, 3))).isFalse();
    }

    @Test
    void weekendIsNotWorkingTimeEvenAtNoon() {
        assertThat(рабочиеДни().openAt(вЕкатеринбурге(8, 12)))
                .as("Суббота — выходной, время суток здесь ни при чём")
                .isFalse();
    }

    // Границы названы вслух: в 9:00 уже работают, в 18:00 уже нет. Иначе
    // спор «а в шесть ровно?» решался бы каждый раз заново.
    @Test
    void theEdgesAreWhereTheyAreSaidToBe() {
        assertThat(рабочиеДни().openAt(вЕкатеринбурге(3, 9))).isTrue();
        assertThat(рабочиеДни().openAt(вЕкатеринбурге(3, 18))).isFalse();
        assertThat(рабочиеДни().openAt(вЕкатеринбурге(3, 17))).isTrue();
    }

    // Главное про часовые пояса. Расписание считается в зоне поддержки,
    // а не в зоне посетителя: «у него ещё день» ничего не говорит о том,
    // есть ли кто-то на месте в Екатеринбурге.
    @Test
    void theZoneThatCountsIsTheSupportsOwn() {
        // Понедельник, 8 утра в Москве — это 10 утра в Екатеринбурге,
        // то есть рабочее время.
        var утроВМоскве = ZonedDateTime.of(2026, 8, 3, 8, 0, 0, 0, ZoneId.of("Europe/Moscow"));
        assertThat(рабочиеДни().openAt(утроВМоскве)).isTrue();

        // А 17:30 в Москве — это 19:30 в Екатеринбурге: рабочий день кончился,
        // хотя у посетителя он в разгаре.
        var вечерВМоскве = ZonedDateTime.of(2026, 8, 3, 17, 30, 0, 0, ZoneId.of("Europe/Moscow"));
        assertThat(рабочиеДни().openAt(вечерВМоскве)).isFalse();
    }

    // Часы показываются посетителю строкой, и строка эта — из настроек:
    // собранная из дней недели, она превратилась бы в перечисление
    // из пяти слов.
    @Test
    void theHoursAreShownAsWritten() {
        assertThat(рабочиеДни().description()).isEqualTo("Пн–Пт 9:00–18:00 (Екатеринбург)");
    }

    // Пустое значение — это «не переопределяли», а не «часов нет».
    //
    // Так и приходит по умолчанию: часы словами живут в коде, а не
    // в application.properties. Файлы .properties читаются как ISO-8859-1,
    // и кириллица оттуда приезжала в чат как «Ð¿Ð½âÐ¿Ñ» — молча:
    // приложение поднималось, тесты были зелёными, кракозябры видел только
    // посетитель.
    @Test
    void withoutAnOverrideTheHoursAreStillReadable() {
        var byDefault = new SupportHours("MONDAY,FRIDAY", "09:00", "18:00",
                "Asia/Yekaterinburg", "");

        assertThat(byDefault.description())
                .as("Пустая настройка не должна оставлять посетителя без часов")
                .isNotBlank()
                .containsPattern("[А-Яа-я]");
    }
}
