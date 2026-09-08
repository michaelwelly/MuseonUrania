package ru.vedal.portal.chat;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.audit.AuditLog;
import ru.vedal.portal.common.ConflictException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * График дежурств: кто на линии сегодня и кто будет завтра.
 *
 * <p><b>Зачем понадобился.</b> Портал знал часы работы и знал присутствие,
 * и ни то ни другое не отвечало на вопрос «с кого спросить за неотвеченное».
 * Часы — обещание без имени; присутствие — факт про множество: открыто ли
 * хоть одно рабочее место. Пока имени нет, передавать смену некому,
 * и в разделе «Разговоры» стояла плашка «ожидает уточнения»
 * (GitHub issue #51).
 *
 * <p><b>Что здесь считается «сегодня».</b> День в зоне поддержки
 * ({@code vedal.support.zone}), а не в зоне сервера. Сервер может стоять
 * где угодно — это деталь размещения; дежурный сидит там, где написано
 * в настройках, и его «сегодня» кончается по его часам.
 *
 * <p><b>Связь с присутствием.</b> Дежурство и присутствие не заменяют
 * друг друга и оба нужны: дежурство говорит, кто ДОЛЖЕН быть на линии,
 * присутствие — кто НА НЕЙ ЕСТЬ. Расхождение между ними — назначенный
 * дежурный, у которого в рабочее время не открыто рабочее место, —
 * и есть то единственное, о чём стоит оповещать: остальные сочетания
 * либо нормальны, либо ничего не значат.
 *
 * <p><b>Чего здесь нет.</b> Самого оповещения — письма или сообщения
 * в мессенджер. Признак расхождения отдаётся наружу и виден на экране;
 * кому и куда об этом писать, портал не выдумывает. Это решение
 * заказчика, а не разработчика: неверный адресат у ночного письма
 * дороже отсутствующего письма.
 */
@Service
public class DutyRoster {

    /**
     * Сколько дней показывает график по умолчанию.
     *
     * <p>Две недели — это горизонт, на котором о дежурстве договариваются:
     * дальше меняются отпуска и командировки, и заполненный на месяц вперёд
     * график к третьей неделе врёт. Меньше — и передать смену на следующую
     * неделю негде.
     */
    public static final int DEFAULT_HORIZON_DAYS = 14;

    private final DutyShiftRepository shifts;
    private final SupportHours hours;
    private final ChatStream stream;
    private final AuditLog audit;

    public DutyRoster(DutyShiftRepository shifts, SupportHours hours,
                      ChatStream stream, AuditLog audit) {
        this.shifts = shifts;
        this.hours = hours;
        this.stream = stream;
        this.audit = audit;
    }

    /** Сегодня по часам поддержки, а не по часам сервера. */
    public LocalDate today() {
        return LocalDate.now(hours.zone());
    }

    /** Одна смена графика. */
    public record Shift(LocalDate date, String login, String note,
                        String assignedBy, Instant assignedAt) {

        static Shift of(DutyShift entity) {
            return new Shift(entity.getOnDate(), entity.getLogin(), entity.getNote(),
                    entity.getAssignedBy(), entity.getAssignedAt());
        }
    }

    /**
     * Кто сегодня на линии — вместе с тем, что об этом знает присутствие.
     *
     * @param date       сегодняшний день в зоне поддержки
     * @param login      дежурный; {@code null} — на сегодня никого не назначили
     * @param note       записка к смене
     * @param atDesk     у дежурного открыто рабочее место
     * @param staffOnline на линии есть хоть кто-то — не обязательно дежурный
     * @param workingHours идёт ли рабочее время поддержки прямо сейчас
     */
    public record OnDuty(LocalDate date, String login, String note,
                         boolean atDesk, boolean staffOnline, boolean workingHours) {

        /**
         * Повод оповестить: дежурный назначен, время рабочее, а рабочего
         * места он не открыл.
         *
         * <p>Вне рабочего времени это не расхождение, а вечер. Без
         * назначенного дежурного — не расхождение, а пустой график:
         * о нём говорит другая надпись, и путать их значит получить
         * тревогу, которая горит всегда и поэтому не значит ничего.
         */
        public boolean alarm() {
            return login != null && workingHours && !atDesk;
        }
    }

    /** Кто сегодня на линии. */
    @Transactional(readOnly = true)
    public OnDuty onDutyToday() {
        var date = today();
        var shift = shifts.findById(date).orElse(null);
        var login = shift == null ? null : shift.getLogin();
        return new OnDuty(
                date,
                login,
                shift == null ? null : shift.getNote(),
                login != null && stream.atDesk(login),
                stream.staffOnline(),
                hours.openNow());
    }

    /**
     * График на отрезок дней.
     *
     * <p>Отдаются только заполненные дни. Пустые дорисовывает экран:
     * строка «дежурного нет» в базе неотличима от строки, которую забыли
     * удалить.
     */
    @Transactional(readOnly = true)
    public List<Shift> schedule(LocalDate from, LocalDate to) {
        if (from == null) from = today();
        if (to == null) to = from.plusDays(DEFAULT_HORIZON_DAYS - 1L);
        if (to.isBefore(from)) {
            throw new ConflictException("Конец отрезка раньше начала: " + from + " … " + to);
        }
        return shifts.findByOnDateBetweenOrderByOnDate(from, to).stream().map(Shift::of).toList();
    }

    /** Все смены человека, свежие сверху. */
    @Transactional(readOnly = true)
    public List<Shift> shiftsOf(String login) {
        return shifts.findByLoginOrderByOnDateDesc(login).stream().map(Shift::of).toList();
    }

    /**
     * Поставить человека на день.
     *
     * <p>Прошедшие дни закрыты. График вперёд — договорённость, график
     * назад — переписывание истории: смена, «назначенная» вчера, отвечает
     * на вопрос «кто дежурил» не тем, кто дежурил.
     */
    @Transactional
    public Shift assign(LocalDate date, String login, String note, String by) {
        requireFuture(date, "назначить дежурного");

        var было = shifts.findById(date).map(DutyShift::getLogin).orElse(null);

        var shift = shifts.findById(date).orElseGet(DutyShift::new);
        shift.setOnDate(date);
        shift.setLogin(login.trim());
        shift.setNote(blankToNull(note));
        shift.setAssignedBy(by);
        shift.setAssignedAt(Instant.now());
        var saved = shifts.save(shift);

        record(by, "duty.assign", date, было, saved.getLogin(), saved.getNote());
        return Shift.of(saved);
    }

    /**
     * Снять дежурного с дня.
     *
     * <p>Удалением строки, а не пустым логином: «никого» выражается
     * отсутствием записи, и только им. Пустая строка в графике выглядит
     * как занятый день, на котором никого нет.
     */
    @Transactional
    public void release(LocalDate date, String by) {
        requireFuture(date, "снять дежурного");

        var shift = shifts.findById(date).orElse(null);
        if (shift == null) return;

        shifts.delete(shift);
        record(by, "duty.release", date, shift.getLogin(), null, null);
    }

    /**
     * Передать смену: сегодняшнее дежурство переходит другому.
     *
     * <p>Отдельное действие, а не назначение на сегодняшнюю дату, хотя
     * в таблице происходит то же самое. Разница в том, что записано
     * в журнале: «передал смену» отвечает на вопрос «почему на линии
     * не тот, кого ставили», а «назначил дежурного» на него не отвечает.
     *
     * <p>Передавать нечего, если на сегодня никого не ставили: это
     * не передача, а назначение, и делается оно графиком. Отказ здесь
     * лучше молчаливого назначения — иначе кнопка «Передать» становится
     * вторым способом заполнить график, и в журнале появляются передачи
     * от никого.
     */
    @Transactional
    public Shift handOff(String toLogin, String note, String by) {
        var date = today();
        var shift = shifts.findById(date).orElseThrow(() -> new ConflictException(
                "На сегодня дежурного не назначали — передавать нечего. "
                        + "Поставьте человека в графике."));

        var было = shift.getLogin();
        if (было.equals(toLogin.trim())) {
            throw new ConflictException("Смена уже на " + было + ".");
        }

        shift.setLogin(toLogin.trim());
        // Записка прежнего дежурного к новому не относится: она была
        // про его смену. Пустая — значит пустая, а не «оставить старую».
        shift.setNote(blankToNull(note));
        shift.setAssignedBy(by);
        shift.setAssignedAt(Instant.now());
        var saved = shifts.save(shift);

        record(by, "duty.handoff", date, было, saved.getLogin(), saved.getNote());
        return Shift.of(saved);
    }

    private void requireFuture(LocalDate date, String действие) {
        if (date.isBefore(today())) {
            throw new ConflictException("Прошедший день не правится: "
                    + действие + " можно на сегодня или вперёд.");
        }
    }

    /**
     * В журнал — «было» и «стало».
     *
     * <p>Запись «назначил дежурного» без прежнего имени не отвечает
     * на вопрос, что именно изменилось; ровно это правило держит и выдача
     * ролей сотруднику.
     *
     * <p>{@link Map#of} здесь не годится: он не принимает null, а «было»
     * пусто ровно тогда, когда день был свободен, — то есть в самом
     * обычном случае.
     */
    private void record(String actor, String action, LocalDate date,
                        String было, String стало, String note) {
        var payload = new HashMap<String, Object>();
        payload.put("день", date.toString());
        payload.put("было", было);
        payload.put("стало", стало);
        if (note != null) payload.put("записка", note);
        audit.record(actor, action, "duty", date.toString(), payload);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
