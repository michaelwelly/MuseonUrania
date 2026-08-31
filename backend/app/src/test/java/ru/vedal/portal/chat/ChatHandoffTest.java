package ru.vedal.portal.chat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.vedal.portal.audit.AuditEntryRepository;

import static org.assertj.core.api.Assertions.assertThat;

// Как посетитель зовёт живого человека и что делают кнопки виджета.
//
// Замер на живом стенде показал ровно одно: кнопка «Специалист VEDAL»
// отправляла свою подпись как вопрос, поиск отвечал на неё списком изделий,
// а разговор оставался открытым — никого не звали. Попасть к человеку можно
// было единственным способом: задать вопрос, на который Ведалина не найдёт
// ответа. То есть человека получал тот, кому не повезло.
//
// Ни тесты, ни сборка этого не видели: кнопка нажималась, запрос уходил,
// ответ приходил. Неправильным был смысл, а не механика.
class ChatHandoffTest extends ChatTestBase {

    @Autowired
    AuditEntryRepository audit;

    @Test
    void askingForAHumanPutsTheConversationInTheQueue() {
        var thread = desk.callHuman(visitor(), FROM_SITE);

        assertThat(thread.status())
                .as("Позвали человека — разговор обязан встать в очередь рабочего места")
                .isEqualTo(Conversation.WAITING);

        // Посетителю сказано, что произошло. Молчание после нажатия кнопки
        // выглядит как несработавшая кнопка.
        assertThat(thread.messages()).hasSize(1);
        assertThat(thread.messages().getFirst().author()).isEqualTo(ChatMessage.ASSISTANT);
        // Слово, общее обоим ответам: на связи есть человек или нет — сказать
        // о специалисте надо в любом случае. Что именно говорится в каждом
        // из двух случаев, проверяет SupportPresenceTest.
        assertThat(thread.messages().getFirst().body()).containsIgnoringCase("специалист");
    }

    @Test
    void theAssistantGoesQuietOnceAHumanIsCalled() {
        var key = visitor();
        desk.callHuman(key, FROM_SITE);

        var thread = desk.say(key, "Что такое VEDAL A-2000?", FROM_SITE);

        // Машина, отвечающая поверх человека, выглядит как сотрудник,
        // который не читает, что ему пишут.
        assertThat(thread.status()).isEqualTo(Conversation.WAITING);
        assertThat(thread.messages()).hasSize(2);
        assertThat(thread.messages().getLast().author()).isEqualTo(ChatMessage.VISITOR);
    }

    @Test
    void callingTwiceIsCallingOnce() {
        var key = visitor();
        desk.callHuman(key, FROM_SITE);
        var thread = desk.callHuman(key, FROM_SITE);

        // Второе «зову специалиста» в ленте выглядит как второй вызов,
        // а в очереди — как второе обращение. Ни того, ни другого не было.
        assertThat(thread.messages()).hasSize(1);
        assertThat(thread.status()).isEqualTo(Conversation.WAITING);
    }

    @Test
    void theJournalTellsAskedApartFromRanOutOfAnswers() {
        desk.callHuman(visitor(), FROM_SITE);

        var reasons = audit.findAll().stream()
                .filter(e -> "chat.handoff".equals(e.getAction()))
                .map(e -> String.valueOf(e.getPayload()))
                .toList();

        // Просьбу о человеке и отсутствие ответа надо различать: свалив их
        // в одно, разбор качества ответов посчитает первое за второе.
        assertThat(reasons).anyMatch(p -> p.contains("asked"));
    }

    // ————— кнопки —————

    @Test
    void aButtonGetsItsScriptedAnswerInsteadOfTheCatalogue() {
        var thread = desk.say(visitor(), "Запросить КП", "quote", FROM_SITE);

        var answer = thread.messages().getLast();
        assertThat(answer.author()).isEqualTo(ChatMessage.ASSISTANT);

        // На «Запросить КП» приходил список изделий: поиск находил в описаниях
        // похожие слова. Заготовка отвечает на то, что нажали.
        assertThat(answer.body()).contains("специалист");
        assertThat(answer.sources())
                .as("Заготовка ни на что не опирается — источников у неё нет")
                .isEmpty();

        // И главное: разговор остаётся у Ведалины. «Запросить КП» — вопрос,
        // а не просьба о человеке.
        assertThat(thread.status()).isEqualTo(Conversation.OPEN);
    }

    @Test
    void theScriptedQuoteAnswerRefusesToNameAPrice() {
        var thread = desk.say(visitor(), "Запросить КП", "quote", FROM_SITE);
        var answer = thread.messages().getLast().body();

        // Правило проекта сказано вслух, а не обойдено молчанием: человек,
        // нажавший «Запросить КП», должен понимать, почему цифры в ответе нет.
        assertThat(answer).contains("цену");
    }

    @Test
    void anUnknownIntentIsJustAQuestion() {
        // Виджет мог остаться от прошлой версии в открытой вкладке. Незнакомое
        // намерение — не повод отказать: вопрос идёт обычным путём.
        var key = visitor();
        sayAndAnswer(key, "Что такое VEDAL A-2000?", "чего-такого-нет");

        var answer = desk.threadFor(key).messages().getLast();
        assertThat(answer.author()).isEqualTo(ChatMessage.ASSISTANT);
        assertThat(answer.sources()).isNotEmpty();
    }

    @Test
    void typingTheLabelByHandIsNotPressingTheButton() {
        // Намерение приходит нажатием, а не совпадением строк: подпись живёт
        // в интерфейсе и меняется вместе с ним. Набранное руками «Запросить КП»
        // — обычный вопрос, и отвечает на него поиск (или передача человеку,
        // если ничего не нашлось). Заготовка сюда не подставляется.
        var key = visitor();
        sayAndAnswer(key, "Запросить КП");
        var answer = desk.threadFor(key).messages().getLast();

        assertThat(answer.author()).isEqualTo(ChatMessage.ASSISTANT);
        assertThat(answer.body()).doesNotContain("Коммерческое предложение готовит специалист");
    }
}
