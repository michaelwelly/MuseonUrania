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
    void forgetPrunesEntriesOutsideTheWindowButKeepsFreshOnes() {
        // Окно длиной в ничто: первый же вызов allow() успевает устареть
        // немедленно — тест не ждёт реальное время, а сводит окно к нулю.
        var limit = new RateLimit(1, Duration.ZERO);

        assertThat(limit.allow("1.2.3.4")).isTrue();
        limit.forget();

        // Место освободилось: без очистки карта росла бы по одному ключу
        // на каждый уникальный адрес и не освобождалась никогда.
        assertThat(limit.allow("1.2.3.4")).isTrue();
    }
}
