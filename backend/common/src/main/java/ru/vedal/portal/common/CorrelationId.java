package ru.vedal.portal.common;

import org.slf4j.MDC;

import java.util.UUID;

// Сквозной идентификатор запроса. Пишется в логи и в журнал аудита, чтобы
// инцидент разбирался по одной цепочке, а не по совпадению времени.
public final class CorrelationId {

    public static final String KEY = "correlationId";
    public static final String HEADER = "X-Correlation-Id";

    public static String current() {
        var value = MDC.get(KEY);
        return value == null ? "-" : value;
    }

    static void set(String value) {
        MDC.put(KEY, value == null || value.isBlank() ? UUID.randomUUID().toString() : value);
    }

    static void clear() {
        MDC.remove(KEY);
    }

    // Восстановление цепочки в потоке, который не обслуживает HTTP-запрос:
    // relay и потребители событий работают в потоке расписания.
    public static void runWith(String value, Runnable work) {
        var previous = MDC.get(KEY);
        set(value);
        try {
            work.run();
        } finally {
            if (previous == null) clear(); else MDC.put(KEY, previous);
        }
    }

    private CorrelationId() {}
}
