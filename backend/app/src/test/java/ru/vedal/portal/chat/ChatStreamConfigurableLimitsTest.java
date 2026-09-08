package ru.vedal.portal.chat;

import org.junit.jupiter.api.Test;
import ru.vedal.portal.common.TooManyRequestsException;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Пределы ChatStream (сколько вкладок на посетителя, сколько соединений
// на весь портал, сколько рабочих мест) раньше были private static final —
// значением, которое нельзя подкрутить без пересборки. Разбор issue #65
// требует настройку с разумным умолчанием вместо константы в коде: значения
// теперь приходят конструктору, и его умолчания (см. ChatStream) совпадают
// с прежними константами — поведение по умолчанию не изменилось.
//
// Без Spring и без Postgres: класс собирается напрямую, конструктор берёт
// значения так же, как @Value подставит их из настроек.
class ChatStreamConfigurableLimitsTest {

    @Test
    void perVisitorLimitComesFromTheConstructorNotAConstant() {
        var stream = new ChatStream(Duration.ofMinutes(30), 1, 500, 64);
        var key = UUID.randomUUID().toString();

        stream.watch(key);

        // Значение по умолчанию в проде — четыре; здесь предел явно понижен
        // до одного, и вторая вкладка того же ключа обязана упереться в него.
        assertThatThrownBy(() -> stream.watch(key))
                .isInstanceOf(TooManyRequestsException.class);
    }

    @Test
    void totalVisitorsLimitComesFromTheConstructorNotAConstant() {
        var stream = new ChatStream(Duration.ofMinutes(30), 10, 1, 64);

        stream.watch(UUID.randomUUID().toString());

        // Первый посетитель уже занял единственное место в предельно
        // суженном общем пуле — второй, с другим ключом, получает отказ.
        assertThatThrownBy(() -> stream.watch(UUID.randomUUID().toString()))
                .isInstanceOf(TooManyRequestsException.class);
    }

    @Test
    void deskLimitComesFromTheConstructorNotAConstant() {
        var stream = new ChatStream(Duration.ofMinutes(30), 4, 500, 1);

        stream.watchAll("editor");

        assertThatThrownBy(() -> stream.watchAll("sales"))
                .isInstanceOf(TooManyRequestsException.class);
    }
}
