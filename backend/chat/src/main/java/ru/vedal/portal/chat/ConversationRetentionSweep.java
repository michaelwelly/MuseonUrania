package ru.vedal.portal.chat;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import ru.vedal.portal.common.OnRetentionTerm;

import java.time.Instant;
import java.time.Period;
import java.time.ZoneOffset;

// Срок хранения разговоров: те, что начались раньше него, обезличиваются сами.
//
// ————— свой срок, а не срок заявки —————
//
// Разговор и заявка — разные предметы хранения: заявка живёт, пока по ней
// не закрыт вопрос, а разговор — это уже случившийся факт общения. У них
// может быть разная причина хранить и разный срок, поэтому свойство
// отдельное — vedal.privacy.retention.chat, а не то же самое, что у заявок.
//
// ————— почему выключено по умолчанию —————
//
// Тот же открытый вопрос 12.2 из docs/PROJECT.md, что и у заявок: срок
// не подтверждён заказчиком, а обезличивание необратимо. Без свойства
// vedal.privacy.retention.chat — или с пустым его значением — @OnRetentionTerm
// не создаёт этот класс вовсе — включается одной переменной в тот день,
// когда срок назван:
//
//   VEDAL_PRIVACY_RETENTION_CHAT=P3Y
//
// ————— почему пачками —————
//
// То же рассуждение, что у RetentionSweep в crm: за первый проход после
// включения под нож пойдёт всё накопленное, и одной транзакцией это
// блокировка таблицы на минуты.
@Component
@OnRetentionTerm("vedal.privacy.retention.chat")
public class ConversationRetentionSweep {

    private static final Logger log = LoggerFactory.getLogger(ConversationRetentionSweep.class);

    // Основание для журнала и для отметки в записи — то же слово, что
    // и у заявок (PersonalData.Basis.RETENTION в crm), но текстом, а не через
    // общий enum: chat и crm друг о друге не знают, и заводить зависимость
    // ради одной строки означало бы потерять возможность вынести чат отдельно.
    private static final String RETENTION_BASIS = "истёк срок хранения";

    private final ConversationRepository conversations;
    private final ChatPrivacy privacy;
    private final Period retention;
    private final int batch;

    public ConversationRetentionSweep(ConversationRepository conversations, ChatPrivacy privacy,
                                      @Value("${vedal.privacy.retention.chat}") String retention,
                                      @Value("${vedal.privacy.batch.chat:500}") int batch) {
        this.conversations = conversations;
        this.privacy = privacy;
        // Period, а не Duration: срок называют в годах, а год — это не
        // «365 дней». Разбор при старте, а не при первом проходе: опечатка
        // в переменной должна ронять запуск, а не тихо ждать своего часа.
        this.retention = Period.parse(retention);
        this.batch = batch;

        log.info("Срок хранения персональных данных разговоров: {}. Обезличивание включено.",
                retention);
    }

    @Scheduled(cron = "${vedal.privacy.sweep-cron.chat:0 35 3 * * *}")
    public void sweep() {
        var cutoff = Instant.now().atZone(ZoneOffset.UTC).minus(retention).toInstant();

        var expired = conversations.findByStartedAtBeforeAndErasedAtIsNull(
                cutoff, PageRequest.of(0, batch));
        if (expired.isEmpty()) return;

        for (var conversation : expired) {
            privacy.erase(conversation.getId(), RETENTION_BASIS, "система");
        }

        // Считаем и пишем: удаление по расписанию — единственная операция,
        // которую никто не заказывал и никто не видит.
        log.info("Обезличено разговоров по сроку хранения: {} (старше {})",
                expired.size(), cutoff);
    }
}
