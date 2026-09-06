package ru.vedal.portal.chat;

import org.springframework.beans.factory.annotation.Autowired;
import ru.vedal.portal.PostgresTestBase;

import java.util.UUID;

/**
 * Общее для тестов разговора: как задать вопрос и получить ответ.
 *
 * <p><b>Почему это два шага.</b> Портал принимает вопрос одной транзакцией
 * и отвечает на него отдельно, в другом потоке: модель считает секундами,
 * и ответ в теле того же запроса означал бы неподвижное окно у посетителя
 * и занятый поток обслуживания на каждый вопрос.
 *
 * <p>В тесте второй шаг делается вручную, и обойти это нечем: тест идёт
 * в транзакции, которая откатывается, до COMMIT дело не доходит — а слушатель,
 * запускающий ответ, ждёт именно COMMIT. Вызывается при этом тот же самый
 * метод, что и в работающем портале, а не его копия для тестов.
 */
public abstract class ChatTestBase extends PostgresTestBase {

    @Autowired
    protected ChatDesk desk;

    @Autowired
    protected Answering answering;

    protected static final ChatDesk.Context FROM_SITE =
            new ChatDesk.Context("ru", null, "/products/");

    /** Новый посетитель: случайный ключ вкладки, о человеке не говорит ничего. */
    protected static String visitor() {
        return UUID.randomUUID().toString();
    }

    /**
     * Спросить и дождаться ответа.
     *
     * @return лента на момент приёма — с вопросом, но ещё без ответа. Ответ
     *         к возврату уже записан; читают его {@code threadFor} или
     *         {@code threadOf}, и читает намеренно сам тест: обе двери
     *         попутно ставят отметку «прочитано», а для части проверок
     *         это и есть предмет разговора.
     */
    protected ChatDesk.Thread sayAndAnswer(String visitorKey, String text) {
        return sayAndAnswer(visitorKey, text, null);
    }

    /** То же с нажатой кнопкой быстрого ответа. */
    protected ChatDesk.Thread sayAndAnswer(String visitorKey, String text, String intent) {
        var accepted = desk.say(visitorKey, text, intent, FROM_SITE);

        // Кнопка отвечается сразу и без движка: её текст известен заранее.
        // Второй шаг здесь означал бы второй ответ на один вопрос.
        if (answered(accepted)) return accepted;

        answering.answer(new ChatDesk.Asked(accepted.id(), visitorKey, text));
        return accepted;
    }

    private static boolean answered(ChatDesk.Thread thread) {
        return !thread.messages().isEmpty()
                && !ChatMessage.VISITOR.equals(thread.messages().getLast().author());
    }
}
