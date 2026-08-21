package ru.vedal.portal.chat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockAsyncContext;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;
import ru.vedal.portal.common.TooManyRequestsException;

import java.util.ArrayList;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Пределы подписок на поток обновлений.
//
// Дверь `GET /chat/{visitorKey}/stream` открыта анониму и, в отличие
// от остальных публичных, под лимитом частоты не стоит — и не может: лимит
// считает обращения, а здесь важно не сколько раз обратились, а сколько
// соединений держат открытыми. Каждое живёт полчаса и занимает поток
// обслуживания.
//
// Без предела цикл из десяти строк складывает приложение, не превысив
// ни одного счётчика: обращений мало, соединений много.
//
// ───────────────────────────────────────────────────────────────────────────
// Почему освобождение места проверяется через настоящую дверь
//
// Первая версия теста звала emitter.complete() у объекта, полученного напрямую
// из ChatStream, и падала на том, что место не освободилось. Причина не в коде:
// SseEmitter, не привязанный к запросу, свои onCompletion/onTimeout/onError
// не выполняет вовсе — их запускает контейнер, когда завершается асинхронный
// запрос. Тест мерил испытательный стенд.
@AutoConfigureMockMvc
class ChatStreamLimitsTest extends PostgresTestBase {

    @Autowired
    ChatStream stream;

    @Autowired
    MockMvc mvc;

    private static String visitor() {
        return UUID.randomUUID().toString();
    }

    @Test
    void aVisitorMayHaveSeveralTabsButNotAThousand() {
        var key = visitor();
        var opened = new ArrayList<>();

        // Четыре — это вкладки одного человека: сайт открыт в двух-трёх
        // и виджет в каждой.
        for (var i = 0; i < 4; i++) {
            opened.add(stream.watch(key));
        }
        assertThat(opened).hasSize(4);

        // Пятая означает, что подписки не снимаются, а не что человеку мало.
        assertThatThrownBy(() -> stream.watch(key))
                .isInstanceOf(TooManyRequestsException.class);
    }

    @Test
    void theDoorAnswersWithARefusalRatherThanASilentlyDeadStream() throws Exception {
        var key = visitor();
        for (var i = 0; i < 4; i++) {
            mvc.perform(get(url(key))).andExpect(request().asyncStarted());
        }

        // Отказ, а не пустой поток: виджет, получив закрытое соединение,
        // переподключается — и упирается в предел снова, уже циклом.
        // 429 он понимает и ждёт.
        mvc.perform(get(url(key))).andExpect(status().isTooManyRequests());
    }

    @Test
    void closingATabFreesItsSlot() throws Exception {
        var key = visitor();
        var first = mvc.perform(get(url(key))).andExpect(request().asyncStarted()).andReturn();
        for (var i = 0; i < 3; i++) {
            mvc.perform(get(url(key))).andExpect(request().asyncStarted());
        }

        mvc.perform(get(url(key))).andExpect(status().isTooManyRequests());

        // Вкладку закрыли — место освободилось. Иначе предел из защиты
        // превращается в счётчик «сколько раз этот браузер открывал сайт»,
        // и через день чат перестаёт работать у постоянного посетителя.
        finish(first);

        mvc.perform(get(url(key)))
                .andExpect(request().asyncStarted());
    }

    // Тест на двойное завершение здесь был и убран. Он проверял, что
    // соединение, о завершении которого контейнер сообщил дважды, освобождает
    // одно место, а не два, — и проходил одинаково, была защита в коде или нет:
    // предел на ключ считается по списку, а список к повторному удалению
    // безразличен. Зелёный тест, который не краснеет от снятой защиты, хуже
    // отсутствующего: он говорит, что место проверено.
    //
    // Вместо сторожа убрана сама возможность: общее число открытых соединений
    // считается обходом карты, а не вторым счётчиком рядом с ней. Расходиться
    // теперь нечему — см. ChatStream.openStreams().

    private static String url(String key) {
        return "/api/assistant/v1/chat/" + key + "/stream";
    }

    // Завершение асинхронного запроса — то же, что закрытая вкладка:
    // контейнер сообщает об этом слушателям, и подписка снимается.
    private static void finish(org.springframework.test.web.servlet.MvcResult result) {
        var async = result.getRequest().getAsyncContext();
        if (async instanceof MockAsyncContext context) {
            context.getListeners().forEach(listener -> {
                try {
                    listener.onComplete(new jakarta.servlet.AsyncEvent(context));
                } catch (Exception ignored) {
                    // Слушатель, упавший на завершении, не должен ронять тест:
                    // проверяется освобождение места, а не поведение контейнера.
                }
            });
        }
    }
}
