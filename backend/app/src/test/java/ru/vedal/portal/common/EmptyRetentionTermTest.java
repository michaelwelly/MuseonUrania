package ru.vedal.portal.common;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;
import ru.vedal.portal.PostgresTestBase;
import ru.vedal.portal.chat.ConversationRetentionSweep;
import ru.vedal.portal.crm.RetentionSweep;
import ru.vedal.portal.notifications.MailRetentionSweep;

import static org.assertj.core.api.Assertions.assertThat;

// Пустая переменная срока — это НЕ срок.
//
// Три переменные VEDAL_PRIVACY_RETENTION* доезжают до портала через compose
// и перечислены в backend/.env.example пустыми: рычаг должен быть виден
// тому, кто разворачивает, ещё до того, как заказчик назовёт число. Пустое
// значение при этом означает ровно то, что означает, — срок не назван.
//
// Проверяем оба следствия сразу, потому что второе страшнее первого:
//   1) автоочистки нет — данные не трогаются;
//   2) портал ПОДНЯЛСЯ — пустая переменная не роняет запуск.
//
// Без @OnRetentionTerm этот контекст не собрался бы вовсе: @ConditionalOnProperty
// считает пустую строку заданным значением, бин создавался бы, и Period.parse("")
// уронил бы старт портала из-за настройки, которую никто не включал.
@TestPropertySource(properties = {
        "vedal.privacy.retention=",
        "vedal.privacy.retention.chat=",
        "vedal.privacy.retention.mail="
})
class EmptyRetentionTermTest extends PostgresTestBase {

    @Autowired
    ApplicationContext context;

    @Test
    void emptyTermLeavesEveryRetentionSweepOut() {
        assertThat(context.getBeanNamesForType(RetentionSweep.class))
                .as("Пустой срок хранения заявок не включает автоочистку")
                .isEmpty();
        assertThat(context.getBeanNamesForType(ConversationRetentionSweep.class))
                .as("Пустой срок хранения разговоров не включает автоочистку")
                .isEmpty();
        assertThat(context.getBeanNamesForType(MailRetentionSweep.class))
                .as("Пустой срок хранения писем не включает автоочистку")
                .isEmpty();
    }
}
