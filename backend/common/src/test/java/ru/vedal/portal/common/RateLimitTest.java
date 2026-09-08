package ru.vedal.portal.common;

import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

// Механизм, на котором держится весь периметр DDoS-разбора issue #65:
// формы, ассистент, чат, документы — каждая публичная дверь заводит свой
// экземпляр этого класса со своим бюджетом. Ошибка здесь бьёт по всем сразу,
// а прямого теста на сам класс до сих пор не было — только косвенно, через
// контроллеры.
class RateLimitTest {

    @Test
    void allowsExactlyTheConfiguredCountWithinTheWindow() {
        var limit = new RateLimit(3, Duration.ofMinutes(10));

        assertThat(limit.allow("1.2.3.4")).isTrue();
        assertThat(limit.allow("1.2.3.4")).isTrue();
        assertThat(limit.allow("1.2.3.4")).isTrue();

        // Четвёртое в то же окно — отказ, а не тихий пропуск: без него
        // предел существует только на бумаге.
        assertThat(limit.allow("1.2.3.4")).isFalse();
    }

    @Test
    void eachClientHasItsOwnBudget() {
        var limit = new RateLimit(1, Duration.ofMinutes(10));

        assertThat(limit.allow("1.2.3.4")).isTrue();

        // Соседний адрес не должен упереться в чужой счётчик — иначе один
        // назойливый клиент запирает дверь всем остальным разом.
        assertThat(limit.allow("5.6.7.8")).isTrue();
        assertThat(limit.allow("1.2.3.4")).isFalse();
    }

    @Test
    void forgetPrunesEntriesOutsideTheWindowButKeepsFreshOnes() throws InterruptedException {
        // Окно короткое, но не нулевое, и тест честно его пережидает.
        //
        // Сначала здесь стояло Duration.ZERO в расчёте, что запись устареет
        // немедленно и ждать не придётся. Не устаревала: отметка сравнивается
        // строго (`isBefore`), а два вызова Instant.now() подряд на Windows
        // возвращают одно и то же значение — разрешение системного таймера
        // грубее, чем расстояние между ними. Тест падал не всегда, а когда
        // повезёт с моментом.
        var limit = new RateLimit(1, Duration.ofMillis(20));

        assertThat(limit.allow("1.2.3.4")).isTrue();
        assertThat(limit.allow("1.2.3.4")).as("лимит исчерпан").isFalse();

        Thread.sleep(40);
        limit.forget();

        // Место освободилось: без очистки карта росла бы по одному ключу
        // на каждый уникальный адрес и не освобождалась никогда.
        assertThat(limit.allow("1.2.3.4")).isTrue();
    }
}
