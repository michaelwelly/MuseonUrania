package ru.vedal.portal.chat;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Смена: кто на линии в этот день.
 *
 * <p><b>Чем это отличается от часов работы и от присутствия.</b> Часы
 * работы ({@link SupportHours}) обещают, что кто-то ответит, и не говорят
 * кто. Присутствие ({@link ChatStream#staffOnline()}) — факт про множество:
 * открыто ли хоть одно рабочее место. Дежурство называет человека, и только
 * с ним разговор о передаче смены и о неотвеченном вопросе становится
 * разговором о ком-то конкретном.
 *
 * <p><b>Почему день, а не интервал.</b> Часы поддержки — один отрезок
 * на будний день; вторая смена внутри него была бы дроблением одного
 * отрезка, а не расписанием. Интервал стоит дорого — запрет пересечений
 * в схеме, диапазонная выборка вместо чтения строки, календарь, который
 * превращается в диаграмму, — и окупится в тот день, когда появится
 * ночная смена.
 *
 * <p><b>Ключ — дата.</b> Дежурный на день один: два дежурных дают два
 * ответа на вопрос «с кого спрашивать», то есть ни одного.
 *
 * <p><b>Чего здесь нет.</b> Истории передач. Кто дежурил до передачи смены,
 * помнит журнал аудита — там записано и «было», и «стало». Вторая история
 * тех же событий рядом разошлась бы с журналом на первой же правке.
 */
@Entity
@Table(name = "duty_shift")
public class DutyShift {

    /** День дежурства в зоне поддержки, он же ключ. */
    @Id
    @Column(name = "on_date")
    private LocalDate onDate;

    /**
     * Логин в том виде, в каком его знает провайдер идентичности.
     *
     * <p>Внешнего ключа нет и быть не может: сотрудники живут в Keycloak,
     * а не в таблице портала. Что логин существует, проверяет дверь —
     * там же, где это проверяется у поля «ответственный».
     */
    private String login;

    /**
     * Записка людям: «до 15:00, дальше Иванов», «работаю из дома».
     *
     * <p>Портал по ней ничего не решает. Признак, по которому что-то
     * решается, — это поле со значением, а не свободный текст.
     */
    private String note;

    /** Кто поставил. Вопрос «почему я сегодня дежурю» задают об этом. */
    @Column(name = "assigned_by")
    private String assignedBy;

    @Column(name = "assigned_at")
    private Instant assignedAt = Instant.now();

    @Version
    private long version;

    public LocalDate getOnDate() { return onDate; }
    public void setOnDate(LocalDate onDate) { this.onDate = onDate; }
    public String getLogin() { return login; }
    public void setLogin(String login) { this.login = login; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public String getAssignedBy() { return assignedBy; }
    public void setAssignedBy(String assignedBy) { this.assignedBy = assignedBy; }
    public Instant getAssignedAt() { return assignedAt; }
    public void setAssignedAt(Instant assignedAt) { this.assignedAt = assignedAt; }
    public long getVersion() { return version; }
    public void setVersion(long version) { this.version = version; }
}
