package ru.vedal.portal.chat;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.audit.AuditLog;
import ru.vedal.portal.common.NotFoundException;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

// Уничтожение персональных данных в переписке.
//
// ————— почему отдельная служба, а не PersonalData из crm —————
//
// `crm` и `chat` друг о друге не знают, и это не случайность: заявка может
// прийти без разговора (форма на сайте, письмо), а разговор — не дорасти
// до заявки. Связать модули ради обезличивания значит завести зависимость
// ради одной операции и потерять возможность вынести чат отдельно.
//
// Сшивает их админская дверь: она зависит от обоих и знает, что обращение
// человека — одно, а данные его лежат в двух местах.
//
// ————— что здесь персональные данные —————
//
// Сам разговор их почти не содержит: ключ вкладки о человеке не сообщает
// ничего, язык и кампания — свойства перехода, а не лица. Персональные данные
// здесь в ТЕЛАХ сообщений: посетитель волен написать «меня зовут Иванов, мой
// телефон…» в свободном поле, и обычно именно так и пишет.
//
// Поэтому стираются тела, а сама лента остаётся: по ней видно, что разговор
// был, сколько он длился и чем кончился. Удалить его целиком значит потерять
// след работы сотрудника — а работа была, и за неё отвечали.
@Service
public class ChatPrivacy {

    /** Та же метка, что у карточек CRM: человек не должен гадать, что это. */
    public static final String ERASED = "удалено";

    private final ConversationRepository conversations;
    private final ChatMessageRepository messages;
    private final AuditLog audit;

    public ChatPrivacy(ConversationRepository conversations, ChatMessageRepository messages,
                       AuditLog audit) {
        this.conversations = conversations;
        this.messages = messages;
        this.audit = audit;
    }

    /**
     * Уничтожить персональные данные разговора.
     *
     * @return {@code false}, если они уже были уничтожены раньше.
     */
    @Transactional
    public boolean erase(UUID id, String basis, String actor) {
        var conversation = conversations.findById(id)
                .orElseThrow(() -> new NotFoundException("Разговор не найден"));
        return erase(conversation, basis, actor);
    }

    /**
     * Уничтожить данные разговоров, из которых выросла заявка.
     *
     * <p>Обращение человек подаёт одно, а данные его лежат в двух местах.
     * Стереть заявку и оставить переписку, которая её породила, — это не
     * исполненное обращение, а половина.
     *
     * @return сколько разговоров обезличено этим вызовом.
     */
    @Transactional
    public int eraseByLead(UUID leadId, String basis, String actor) {
        var found = conversations.findByLeadId(leadId);
        var erased = 0;
        for (var conversation : found) {
            if (erase(conversation, basis, actor)) erased++;
        }
        return erased;
    }

    private boolean erase(Conversation conversation, String basis, String actor) {
        if (conversation.getErasedAt() != null) return false;

        for (var message : messages.findByConversationIdOrderByAtAsc(conversation.getId())) {
            // Стираются тела всех трёх авторов, а не только посетителя:
            // сотрудник в ответе повторяет имя и телефон чаще, чем кажется,
            // а ответ Урании цитирует вопрос.
            message.setBody(ERASED);
            // Источники — ссылки на опубликованные материалы, персональных
            // данных в них нет. Но без тела они бессмысленны, а бессмысленное
            // в карточке мешает читать.
            message.setSources(null);
        }

        conversation.setErasedAt(Instant.now());
        conversation.setErasureBasis(basis);

        audit.record(actor, "conversation.erased", "conversation",
                conversation.getId().toString(), Map.of("basis", basis));
        return true;
    }
}
