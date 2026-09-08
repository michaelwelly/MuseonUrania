package ru.vedal.portal.admin.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.vedal.portal.chat.ChatStream;
import ru.vedal.portal.chat.DutyRoster;
import ru.vedal.portal.chat.SupportHours;
import ru.vedal.portal.common.ConflictException;
import ru.vedal.portal.iam.StaffDirectory;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Дежурство: кто сегодня на линии.
 *
 * <p><b>Зачем эта дверь.</b> Портал знал часы работы поддержки и знал
 * присутствие — открыто ли хоть одно рабочее место. Ни то ни другое
 * не называет человека, а без имени смену некому передать и не с кого
 * спросить за неотвеченный вопрос. В разделе «Разговоры» на этом месте
 * стояла плашка «ожидает уточнения» (GitHub issue #51).
 *
 * <p><b>Что дверь добавляет к домену.</b> Ровно два: логин превращается
 * в имя справочником сотрудников, и логин проверяется на существование.
 * Внешнего ключа на сотрудника нет и быть не может — сотрудники живут
 * в Keycloak; проверка стоит здесь, как и у поля «ответственный».
 */
@RestController
@RequestMapping("/api/admin/v1/duty")
@Tag(name = "Админка: дежурство")
@SecurityRequirement(name = "keycloak")
public class AdminDutyApi {

    private final DutyRoster roster;
    private final StaffDirectory staff;
    private final SupportHours hours;
    private final ChatStream stream;

    public AdminDutyApi(DutyRoster roster, StaffDirectory staff, SupportHours hours,
                        ChatStream stream) {
        this.roster = roster;
        this.staff = staff;
        this.hours = hours;
        this.stream = stream;
    }

    @Schema(name = "DutyShift", description = "Смена: кто на линии в этот день.")
    public record ShiftView(
            @Schema(description = "День дежурства в зоне поддержки.", example = "2026-09-08")
            LocalDate date,
            @Schema(description = "Логин дежурного.", example = "editor")
            String login,
            @Schema(description = "Имя из справочника. Пусто — учётной записи "
                    + "с таким логином там больше нет.", nullable = true)
            String name,
            @Schema(description = "Записка к смене: «до 15:00, дальше Иванов». "
                    + "Портал по ней ничего не решает.", nullable = true)
            String note,
            @Schema(description = "Кто поставил.")
            String assignedBy,
            Instant assignedAt,
            @Schema(description = "Открыто ли у дежурного рабочее место прямо сейчас. "
                    + "Осмысленно только у сегодняшнего дня.")
            boolean atDesk) {}

    @Schema(name = "DutyToday", description = """
            Кто сегодня на линии — вместе с тем, что об этом знает присутствие.
            """)
    public record TodayView(
            LocalDate date,
            @Schema(description = "Дежурный. Пусто — на сегодня никого не назначили.",
                    nullable = true)
            String login,
            @Schema(nullable = true) String name,
            @Schema(nullable = true) String note,
            @Schema(description = "У дежурного открыто рабочее место.")
            boolean atDesk,
            @Schema(description = "На линии есть хоть кто-то — не обязательно дежурный.")
            boolean staffOnline,
            @Schema(description = "Идёт ли рабочее время поддержки прямо сейчас.")
            boolean workingHours,
            @Schema(description = """
                    Повод оповестить: дежурный назначен, время рабочее, а рабочего
                    места он не открыл. Вне рабочего времени это не расхождение,
                    а вечер; без назначенного дежурного — не расхождение, а пустой
                    график, и говорит о нём другая надпись.

                    Самого оповещения — письма или сообщения в мессенджер — портал
                    не шлёт: кому и куда писать, решает заказчик.
                    """)
            boolean alarm,
            @Schema(description = "Часы работы поддержки словами.",
                    example = "Пн–Пт 9:00–17:30 (Екатеринбург)")
            String supportHours) {}

    @Operation(summary = "Кто сегодня на линии", description = """
            День считается в зоне поддержки (`vedal.support.zone`), а не в зоне
            сервера: «сегодня» кончается по часам дежурного.

            Дежурство и присутствие отдаются вместе и не заменяют друг друга.
            Дежурство говорит, кто ДОЛЖЕН быть на линии; присутствие — кто
            на ней ЕСТЬ. Расхождение между ними и есть единственное, о чём
            стоит оповещать.
            """)
    @GetMapping("/today")
    public TodayView today() {
        var duty = roster.onDutyToday();
        return new TodayView(
                duty.date(), duty.login(), nameOf(duty.login()), duty.note(),
                duty.atDesk(), duty.staffOnline(), duty.workingHours(), duty.alarm(),
                hours.description());
    }

    @Operation(summary = "График дежурств", description = """
            Заполненные дни отрезка, по порядку. Дни без дежурного строк не имеют:
            запись «дежурного нет» в базе неотличима от записи, которую забыли
            удалить, — пустые дни дорисовывает экран.

            Без параметров — от сегодня на две недели вперёд. Дальше договориться
            всё равно нельзя: отпуска и командировки меняются, и график,
            заполненный на месяц, к третьей неделе врёт.
            """)
    @GetMapping
    public List<ShiftView> schedule(
            @Parameter(description = "С какого дня включительно. По умолчанию сегодня.")
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @Parameter(description = "По какой день включительно. По умолчанию "
                    + "13 дней от начала.")
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        // Справочник спрашивается один раз на весь график, а не по строке:
        // в режиме keycloak это поход в чужую систему, и две недели графика
        // означали бы четырнадцать походов ради четырнадцати имён.
        var names = names();
        var today = roster.today();
        return roster.schedule(from, to).stream()
                .map(shift -> view(shift, names, today))
                .toList();
    }

    @Schema(name = "DutyAssignment", description = "Кого поставить и с какой запиской.")
    public record Assignment(
            @NotBlank
            @Schema(description = "Логин сотрудника. Он обязан существовать "
                    + "в справочнике.", example = "editor")
            String login,
            @Size(max = 500)
            @Schema(description = "Записка к смене. Необязательна.", nullable = true)
            String note) {}

    @Operation(summary = "Поставить дежурного на день", description = """
            Что прислали, то и стало: на день дежурный один. Прошедшие дни
            не правятся — график вперёд это договорённость, график назад
            это переписывание истории.
            """)
    @ApiResponse(responseCode = "409",
            description = "Прошедший день или логин, которого нет в справочнике.")
    @PutMapping("/{date}")
    public ShiftView assign(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                            LocalDate date,
                            @Valid @RequestBody Assignment body,
                            Authentication who) {
        requireKnown(body.login());
        return view(roster.assign(date, body.login(), body.note(), Actor.of(who)));
    }

    @Operation(summary = "Снять дежурного с дня", description = """
            «Никого» выражается отсутствием записи, а не пустым логином:
            пустая строка в графике выглядит как занятый день, на котором
            никого нет.
            """)
    @ApiResponse(responseCode = "204", description = "Снято; или дежурного и не было.")
    @DeleteMapping("/{date}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void release(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                        LocalDate date, Authentication who) {
        roster.release(date, Actor.of(who));
    }

    @Operation(summary = "Передать смену", description = """
            Сегодняшнее дежурство переходит другому. В таблице происходит то же,
            что при назначении на сегодня, а в журнале — разное: «передал смену»
            отвечает на вопрос «почему на линии не тот, кого ставили»,
            «назначил дежурного» на него не отвечает.

            Передавать нечего, если на сегодня никого не ставили: это
            не передача, а назначение, и делается оно графиком.
            """)
    @ApiResponse(responseCode = "409",
            description = "На сегодня дежурного нет, смена уже на этом человеке "
                    + "или логина нет в справочнике.")
    @PostMapping("/handoff")
    public ShiftView handOff(@Valid @RequestBody Assignment body, Authentication who) {
        requireKnown(body.login());
        return view(roster.handOff(body.login(), body.note(), Actor.of(who)));
    }

    /**
     * Логин обязан существовать.
     *
     * <p>Та же беда, ради которой у заявки и сделки появился справочник
     * ответственных: опечатка в свободной строке ничем не отличается
     * от правильного логина, и день оказывается записан на человека,
     * которого нет. У дежурства это дороже — по нему решают, кому звонить.
     *
     * <p>Отключённые сотрудники в списке остаются (на них старые сделки),
     * но поставить отключённого дежурить нельзя: учётная запись выключена
     * ровно тогда, когда человек в портал больше не входит.
     */
    private void requireKnown(String login) {
        var person = staff.staff().stream()
                .filter(p -> p.login().equals(login.trim()))
                .findFirst()
                .orElseThrow(() -> new ConflictException(
                        "В справочнике нет сотрудника с логином " + login.trim() + "."));

        if (!person.enabled()) {
            throw new ConflictException("Учётная запись " + person.login()
                    + " отключена — дежурить он не может.");
        }
    }

    private ShiftView view(DutyRoster.Shift shift) {
        return view(shift, names(), roster.today());
    }

    private ShiftView view(DutyRoster.Shift shift, Map<String, String> names, LocalDate today) {
        return new ShiftView(shift.date(), shift.login(), names.get(shift.login()),
                shift.note(), shift.assignedBy(), shift.assignedAt(),
                // Присутствие осмысленно только у сегодняшнего дня: у завтрашней
                // смены «на месте» означало бы, что человек сидит в чужой день.
                shift.date().equals(today) && stream.atDesk(shift.login()));
    }

    /**
     * Логины в имена, одним походом в справочник.
     *
     * <p>Логина в карте нет — значит, учётной записи с таким логином там
     * больше нет: человека уволили, а прошедшие смены остались. Прятать
     * их значит терять историю; выдумывать ему имя — тем более.
     */
    private Map<String, String> names() {
        return staff.staff().stream()
                .collect(Collectors.toMap(StaffDirectory.Person::login,
                        StaffDirectory.Person::label, (a, b) -> a));
    }

    private String nameOf(String login) {
        return login == null ? null : names().get(login);
    }
}
