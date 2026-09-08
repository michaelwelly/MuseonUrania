package ru.vedal.portal.chat;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface DutyShiftRepository extends JpaRepository<DutyShift, LocalDate> {

    /**
     * Смены за отрезок дней, по порядку.
     *
     * <p>Границы включительно с обеих сторон: экран графика спрашивает
     * «с сегодня по такое-то число», и полуоткрытый отрезок здесь означал бы,
     * что последний день двухнедельного графика молча не показывается.
     *
     * <p>Дни без дежурного строк не имеют — их дорисовывает тот, кто строит
     * календарь. Заводить пустые строки ради ровного списка значит завести
     * запись «дежурного нет», которую невозможно отличить от «строку забыли
     * удалить».
     */
    List<DutyShift> findByOnDateBetweenOrderByOnDate(LocalDate from, LocalDate to);

    /** Смены одного человека — для карточки сотрудника и для разбора. */
    List<DutyShift> findByLoginOrderByOnDateDesc(String login);
}
