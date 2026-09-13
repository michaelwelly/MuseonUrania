package ru.vedal.portal.chat;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import ru.vedal.portal.common.RateLimit;

import java.time.Duration;

// Лимиты частоты для дверей чата, у которых нет своего бюджета.
//
// Первый `say` стоит под assistantRateLimit по адресу: новый visitorKey легко
// менять, поэтому им нельзя защищать создание строк в базе. После старта чат
// получает отдельный бюджет по visitorKey: общий адрес клиники не должен
// обрывать уже начатую беседу. `thread` и `typing` имеют свои бюджеты ниже.
//
// Общий лимит с assistantRateLimit им не подходит: `typing` виджет шлёт
// каждые три секунды, пока поле не пустое (см. frontend/lib/submit.ts,
// pingTyping), и за десять минут активного набора это до двухсот обращений —
// в разы больше, чем 20 у ассистента. Заниженный лимит здесь не защита,
// а отказ настоящему посетителю посреди набора сообщения.
@Configuration
public class ChatConfig {

    @Bean
    RateLimit chatMessageRateLimit(@Value("${vedal.chat.message-rate-limit.count:300}") int limit,
                                   @Value("${vedal.chat.message-rate-limit.window:PT10M}") Duration window) {
        return new RateLimit(limit, window);
    }

    // Чтение ленты: на открытие виджета и на каждое событие `changed`.
    // Обращений в разговоре в разы меньше, чем сообщений — но дверь читает
    // базу по чужому ключу без проверки прав, и предел здесь не про частую
    // легитимную нагрузку, а про то, чтобы перебор ключей упирался в потолок,
    // а не в диск.
    @Bean
    RateLimit chatReadRateLimit(@Value("${vedal.chat.read-rate-limit.count:300}") int limit,
                                @Value("${vedal.chat.read-rate-limit.window:PT10M}") Duration window) {
        return new RateLimit(limit, window);
    }

    // «Печатает»: виджет шлёт не чаще раза в три секунды, пока поле не пустое.
    // Двести — потолок при непрерывном наборе весь час-предел окна; запас
    // сверху на реконнект и на то, что тайминг браузера не идеален.
    @Bean
    RateLimit chatTypingRateLimit(@Value("${vedal.chat.typing-rate-limit.count:240}") int limit,
                                  @Value("${vedal.chat.typing-rate-limit.window:PT10M}") Duration window) {
        return new RateLimit(limit, window);
    }
}
