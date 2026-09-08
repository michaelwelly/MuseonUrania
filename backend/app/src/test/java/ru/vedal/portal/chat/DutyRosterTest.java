package ru.vedal.portal.chat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.vedal.portal.PostgresTestBase;
import ru.vedal.portal.audit.AuditEntryRepository;
import ru.vedal.portal.audit.AuditLog;
import ru.vedal.portal.common.ConflictException;

import java.time.Duration;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * График дежурств: кто сегодня на линии.
 *
 * <p>До этого портал знал два факта — часы работы и присутствие, — и ни один
 * не называл человека. Проверяется здесь ровно то, ради чего заводился
 * третий: имя появляется, держится за днём и меняется только вперёд,
 * а каждая смена остаётся в журнале с «было» и «стало».
 *
 * <p><b>Почему присутствие проверяется на своём экземпляре рассылки.</b>
 * Подписки живут в памяти и общие на весь контекст Spring: соседний тест,
 * открывший рабочее место, делает «дежурного на месте нет» недостижимым
 * состоянием. Свой {@link ChatStream} — то же состояние, только известное;
 * классы при этом работают настоящие, а не их подобия.
 */
class DutyRosterTest extends PostgresTestBase {

    @Autowired
    DutyRoster roster;

    @Autowired
    DutyShiftRepository shifts;

    @Autowired
    SupportHours hours;

    @Autowired
    AuditLog audit;

    @Autowired
    AuditEntryRepository entries;

    /** График со своей рассылкой: присутствие здесь известно. */
    private DutyRoster rosterWith(ChatStream stream) {
        return new DutyRoster(shifts, hours, stream, audit);
    }

    private static ChatStream ownStream() {
        return new ChatStream(Duration.ofMinutes(30), 4, 500, 64);
    }

    // ————— день —————

    // «Сегодня» кончается по часам дежурного, а не по часам машины. Сервер
    // может стоять где угодно — это деталь размещения; смена — нет.
    @Test
    void todayIsCountedInTheSupportZone() {
        assertThat(roster.today()).isEqualTo(LocalDate.now(hours.zone()));
    }

    // ————— пустой график —————

    @Test
    void withoutAnAssignmentNobodyIsOnDutyAndNothingIsWrong() {
        var duty = roster.onDutyToday();

        assertThat(duty.login()).isNull();
        assertThat(duty.alarm())
                .as("Пустой график — это пустой график, а не тревога: о нём "
                        + "говорит другая надпись")
                .isFalse();
    }

    // ————— назначение —————

    @Test
    void assigningPutsANamedPersonOnTheDay() {
        var today = roster.today();

        roster.assign(today, "fedorova", "первый день", "boss");

        var duty = roster.onDutyToday();
        assertThat(duty.date()).isEqualTo(today);
        assertThat(duty.login()).isEqualTo("fedorova");
        assertThat(duty.note()).isEqualTo("первый день");
    }

    // На день дежурный один: два ответа на вопрос «с кого спрашивать» —
    // это ни одного.
    @Test
    void asecondAssignmentReplacesTheFirstRatherThanAddingOne() {
        var today = roster.today();

        roster.assign(today, "fedorova", null, "boss");
        roster.assign(today, "petrov", null, "boss");

        assertThat(roster.schedule(today, today))
                .extracting(DutyRoster.Shift::login)
                .containsExactly("petrov");
    }

    // График вперёд — договорённость; график назад — переписывание истории.
    @Test
    void apastDayIsNotEditable() {
        var yesterday = roster.today().minusDays(1);

        assertThatThrownBy(() -> roster.assign(yesterday, "fedorova", null, "boss"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Прошедший день");

        assertThatThrownBy(() -> roster.release(yesterday, "boss"))
                .isInstanceOf(ConflictException.class);
    }

    // «Никого» выражается отсутствием строки, и только им: пустая строка
    // в графике выглядит как занятый день, на котором никого нет.
    @Test
    void releaseRemovesTheRowRatherThanBlankingIt() {
        var today = roster.today();
        roster.assign(today, "fedorova", null, "boss");

        roster.release(today, "boss");

        assertThat(shifts.findById(today)).isEmpty();
        assertThat(roster.onDutyToday().login()).isNull();
    }

    // ————— график —————

    // Отдаются только заполненные дни: строка «дежурного нет» неотличима
    // от строки, которую забыли удалить.
    @Test
    void theScheduleShowsOnlyFilledDays() {
        var today = roster.today();
        roster.assign(today, "fedorova", null, "boss");
        roster.assign(today.plusDays(3), "petrov", null, "boss");

        var две_недели = roster.schedule(today, today.plusDays(13));

        assertThat(две_недели)
                .extracting(DutyRoster.Shift::date)
                .containsExactly(today, today.plusDays(3));
    }

    @Test
    void abackwardsRangeIsRefusedRatherThanAnsweredWithNothing() {
        var today = roster.today();

        assertThatThrownBy(() -> roster.schedule(today, today.minusDays(1)))
                .isInstanceOf(ConflictException.class);
    }

    // ————— передача смены —————

    @Test
    void handOffMovesTodaysShift() {
        var today = roster.today();
        roster.assign(today, "fedorova", "уезжаю в 15:00", "boss");

        roster.handOff("petrov", null, "fedorova");

        var duty = roster.onDutyToday();
        assertThat(duty.login()).isEqualTo("petrov");
        assertThat(duty.note())
                .as("Записка прежнего дежурного была про его смену, а не про чужую")
                .isNull();
    }

    // Передавать нечего, если никого не ставили: это назначение, а не
    // передача, и делается оно графиком. Иначе кнопка «Передать» становится
    // вторым способом заполнить график, и в журнале появляются передачи
    // от никого.
    @Test
    void handOffRefusesWhenNobodyIsOnDutyToday() {
        assertThatThrownBy(() -> roster.handOff("petrov", null, "fedorova"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("передавать нечего");
    }

    @Test
    void handOffToTheSamePersonIsRefused() {
        roster.assign(roster.today(), "fedorova", null, "boss");

        assertThatThrownBy(() -> roster.handOff("fedorova", null, "fedorova"))
                .isInstanceOf(ConflictException.class);
    }

    // ————— журнал —————

    // Запись «назначил дежурного» без прежнего имени не отвечает на вопрос,
    // что именно изменилось. Тем же правилом живёт выдача ролей сотруднику.
    @Test
    void thejournalKeepsBothWhoItWasAndWhoItBecame() {
        var today = roster.today();
        roster.assign(today, "fedorova", null, "boss");
        roster.handOff("petrov", null, "fedorova");

        var записи = entries.findBySubjectAndSubjectIdOrderByAtDesc("duty", today.toString());

        // Порядок здесь не проверяется: обе записи сделаны в одной транзакции
        // и могут лечь в одну миллисекунду. Проверяется, что события два
        // и что они разные, — «передал» и «назначил» отвечают на разные
        // вопросы, и слить их значило бы потерять ответ на второй.
        assertThat(записи)
                .extracting(e -> e.getAction())
                .containsExactlyInAnyOrder("duty.assign", "duty.handoff");

        var передача = записи.stream()
                .filter(e -> e.getAction().equals("duty.handoff"))
                .findFirst()
                .orElseThrow();
        assertThat(передача.getActor()).isEqualTo("fedorova");
        assertThat(передача.getPayload())
                .as("Без прежнего имени запись не отвечает на вопрос, "
                        + "что именно изменилось")
                .contains("fedorova")
                .contains("petrov");
    }

    // ————— связь с присутствием —————

    // Дежурство говорит, кто ДОЛЖЕН быть на линии; присутствие — кто на ней
    // ЕСТЬ. Открытое рабочее место соседа на второй вопрос отвечает,
    // а на первый — нет.
    @Test
    void beingAtADeskIsAskedAboutTheDutyPersonNotAboutAnyone() {
        var stream = ownStream();
        var own = rosterWith(stream);
        own.assign(own.today(), "fedorova", null, "boss");

        assertThat(own.onDutyToday().atDesk()).isFalse();

        stream.watchAll("petrov");
        assertThat(own.onDutyToday())
                .as("На линии кто-то есть, но это не дежурный")
                .satisfies(duty -> {
                    assertThat(duty.staffOnline()).isTrue();
                    assertThat(duty.atDesk()).isFalse();
                });

        stream.watchAll("fedorova");
        assertThat(own.onDutyToday().atDesk()).isTrue();
    }

    // Тревога — это расхождение, а не любое отсутствие. Проверяется на самой
    // записи, а не на поднятом стеке: иначе результат зависел бы от того,
    // в какой день недели и в котором часу запустили сборку.
    @Test
    void thealarmIsOnlyTheDisagreementBetweenDutyAndPresence() {
        var today = LocalDate.of(2026, 9, 8);

        assertThat(onDuty(today, "fedorova", false, true).alarm())
                .as("Назначен, время рабочее, места не открыл — вот об этом и стоит "
                        + "оповещать")
                .isTrue();

        assertThat(onDuty(today, "fedorova", true, true).alarm())
                .as("Дежурный на месте")
                .isFalse();

        assertThat(onDuty(today, "fedorova", false, false).alarm())
                .as("Вне рабочего времени это не расхождение, а вечер")
                .isFalse();

        assertThat(onDuty(today, null, false, true).alarm())
                .as("Без назначенного дежурного тревога горела бы всегда "
                        + "и поэтому не значила бы ничего")
                .isFalse();
    }

    private static DutyRoster.OnDuty onDuty(LocalDate date, String login,
                                            boolean atDesk, boolean workingHours) {
        return new DutyRoster.OnDuty(date, login, null, atDesk, atDesk, workingHours);
    }
}
