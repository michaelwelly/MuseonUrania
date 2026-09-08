package ru.vedal.portal.chat;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import ru.vedal.portal.common.RateLimit;

import java.time.Duration;

// Лимиты частоты для дверей чата, у которых нет своего бюджета.
//
// `say`/`handoff`/`rate`/`ask` уже стоят под assistantRateLimit — это запись
// и вопрос, дорогие по смыслу (движок, база, письмо менеджеру). `thread`
// (чтение ленты) и `typing` (пинг «печатает») были заведены без всякого
// лимита: разбор issue #65 назвал это дверью без счётчика — самой дешёвой,
// через которую можно класть портал.
//
// Общий лимит с assistantRateLimit им не подходит: `typing` виджет шлёт
// каждые три секунды, пока поле не пустое (см. frontend/lib/submit.ts,
// pingTyping), и за десять минут активного набора это до двухсот обращений —
// в разы больше, чем 20 у ассистента. Заниженный лимит здесь не защита,
// а отказ настоящему посетителю посреди набора сообщения.
@Configuration
public class ChatConfig {

    // Чтение ленты: на открытие виджета и на каждое событие `changed`.
    // Обращений в разговоре в разы меньше, чем сообщений — но дверь читает
    // базу по чужому ключу без проверки прав, и предел здесь не про частую
    // легитимную нагрузку, а про то, чтобы перебор ключей упирался в потолок,
    // а не в диск.
    @Bean
    RateLimit chatReadRateLimit(@Value("${vedal.chat.read-rate-limit.count:60}") int limit,
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
