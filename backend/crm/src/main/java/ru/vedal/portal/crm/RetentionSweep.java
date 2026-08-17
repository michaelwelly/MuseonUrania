package ru.vedal.portal.crm;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.Period;
import java.time.ZoneOffset;

// Срок хранения: заявки старше него обезличиваются сами.
//
// ————— почему выключено по умолчанию —————
//
// Срок не подтверждён заказчиком (открытый технический вопрос 12.2, предложено
// три года). Пока он не назван, включать нельзя, и это не осторожность ради
// осторожности: обезличивание необратимо. Ошибись мы со сроком в меньшую
// сторону — вычистим клиентскую базу за позапрошлый квартал, и восстановить
// её будет неоткуда, кроме бэкапа, который тоже стареет.
//
// Поэтому механизм есть, а бина нет: без свойства vedal.privacy.retention
// @ConditionalOnProperty не создаёт этот класс вовсе, и в логе на старте
// нет даже упоминания об очистке. Включается одной переменной в тот день,
// когда срок назван:
//
//   VEDAL_PRIVACY_RETENTION=P3Y
//
// ————— почему пачками —————
//
// За первый же запуск после включения под нож пойдёт всё, что накопилось,
// — это может быть десятки тысяч заявок. Одной транзакцией это блокировка
// таблицы на минуты и распухший журнал предзаписи, из которого Debezium
// будет выгребать всё это время. Пачка за проход, следующая — на следующем.
@Component
@ConditionalOnProperty(name = "vedal.privacy.retention")
public class RetentionSweep {

    private static final Logger log = LoggerFactory.getLogger(RetentionSweep.class);

    private final LeadRepository leads;
    private final PersonalData privacy;
    private final Period retention;
    private final int batch;

    public RetentionSweep(LeadRepository leads, PersonalData privacy,
                          @Value("${vedal.privacy.retention}") String retention,
                          @Value("${vedal.privacy.batch:500}") int batch) {
        this.leads = leads;
        this.privacy = privacy;
        // Period, а не Duration: срок хранения называют в годах, а год — это
        // не «365 дней». Разбор при старте, а не при первом проходе: опечатка
        // в переменной должна ронять запуск, а не тихо ждать своего часа.
        this.retention = Period.parse(retention);
        this.batch = batch;

        log.info("Срок хранения персональных данных заявок: {}. Обезличивание включено.",
                retention);
    }

    @Scheduled(cron = "${vedal.privacy.sweep-cron:0 30 3 * * *}")
    public void sweep() {
        var cutoff = Instant.now().atZone(ZoneOffset.UTC).minus(retention).toInstant();

        var expired = leads.findByCreatedAtBeforeAndErasedAtIsNull(
                cutoff, PageRequest.of(0, batch));
        if (expired.isEmpty()) return;

        for (var lead : expired) {
            privacy.eraseLead(lead.getId(), PersonalData.Basis.RETENTION, "система");
        }

        // Считаем и пишем: удаление по расписанию — единственная операция,
        // которую никто не заказывал и никто не видит. Молчаливая она
        // обнаруживается только тем, что данные пропали.
        log.info("Обезличено заявок по сроку хранения: {} (старше {})", expired.size(), cutoff);
    }
}
