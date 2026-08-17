package ru.vedal.portal.chat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.vedal.portal.PostgresTestBase;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

// Уничтожение персональных данных в переписке.
class ChatPrivacyTest extends PostgresTestBase {

    @Autowired
    ChatDesk desk;

    @Autowired
    ChatPrivacy privacy;

    @Autowired
    ConversationRepository conversations;

    @Autowired
    ru.vedal.portal.crm.LeadRepository leads;

    private static final ChatDesk.Context FROM_SITE =
            new ChatDesk.Context("ru", "innoprom", "/products/");

    private static String visitor() {
        return UUID.randomUUID().toString();
    }

    // Персональные данные здесь — в телах сообщений: посетитель волен написать
    // своё имя и телефон в свободном поле, и обычно именно так и делает.
    @Test
    void erasesEveryMessageBody() {
        var key = visitor();
        var id = desk.say(key, "Меня зовут Иванов, телефон +7 900 000-00-00.", FROM_SITE).id();
        desk.reply(id, "anna", "Иван, здравствуйте, перезвоню на +7 900 000-00-00.");

        assertThat(privacy.erase(id, "обращение субъекта", "anna")).isTrue();

        var after = desk.threadOf(id);
        assertThat(after.messages())
                .as("Стираются тела всех авторов, а не только посетителя")
                .allMatch(m -> ChatPrivacy.ERASED.equals(m.body()));
    }

    // Лента остаётся: по ней видно, что разговор был и чем кончился. Удалить
    // его целиком значит потерять след работы сотрудника — а работа была.
    @Test
    void keepsTheConversationItselfAsEvidenceOfWork() {
        var key = visitor();
        var id = desk.say(key, "Меня зовут Иванов.", FROM_SITE).id();
        desk.reply(id, "anna", "Здравствуйте.");
        var before = desk.threadOf(id).messages().size();

        privacy.erase(id, "обращение субъекта", "anna");

        var conversation = conversations.findById(id).orElseThrow();
        assertThat(conversation.getOwner()).isEqualTo("anna");
        assertThat(conversation.getStatus()).isEqualTo(Conversation.ATTENDED);
        // Свойства перехода — не персональные данные и остаются для аналитики.
        assertThat(conversation.getCampaign()).isEqualTo("innoprom");
        // Сравнение с тем, что было, а не с числом: сколько именно реплик
        // окажется в ленте, зависит от того, ответила ли Урания, — а проверяем
        // мы не это, а что обезличивание не удаляет строки.
        assertThat(desk.threadOf(id).messages()).hasSize(before);
    }

    @Test
    void recordsWhenAndOnWhatGrounds() {
        var id = desk.say(visitor(), "Меня зовут Иванов.", FROM_SITE).id();

        privacy.erase(id, "обращение субъекта", "anna");

        var after = conversations.findById(id).orElseThrow();
        assertThat(after.getErasedAt()).isNotNull();
        assertThat(after.getErasureBasis()).isEqualTo("обращение субъекта");
    }

    @Test
    void secondRequestChangesNothingAndIsNotAnError() {
        var id = desk.say(visitor(), "Меня зовут Иванов.", FROM_SITE).id();
        privacy.erase(id, "обращение субъекта", "anna");

        assertThat(privacy.erase(id, "обращение субъекта", "anna")).isFalse();
    }

    // Обращение человек подаёт одно, а данные лежат в двух местах. Стереть
    // заявку и оставить переписку, которая её породила, — не исполненное
    // обращение, а половина.
    @Test
    void erasingByLeadReachesTheConversationThatProducedIt() {
        var id = desk.say(visitor(), "Меня зовут Иванов.", FROM_SITE).id();

        // Настоящая заявка, а не случайный идентификатор: conversation.lead_id
        // под внешним ключом, и выдуманный UUID туда не встанет. Тест, который
        // это обходит, проверял бы не ту связь, что работает на проде.
        var lead = leads.save(newLead());
        conversations.findById(id).orElseThrow().setLeadId(lead.getId());
        conversations.flush();

        assertThat(privacy.eraseByLead(lead.getId(), "обращение субъекта", "anna")).isEqualTo(1);
        assertThat(conversations.findById(id).orElseThrow().getErasedAt()).isNotNull();
    }

    private ru.vedal.portal.crm.Lead newLead() {
        var lead = new ru.vedal.portal.crm.Lead();
        lead.setId(UUID.randomUUID());
        lead.setForm("quote");
        lead.setName("Иванов Иван");
        lead.setPhone("+7 900 000-00-00");
        lead.setEmail("ivanov@example.ru");
        lead.setMessage("Разговор перерос в заявку.");
        lead.setConsentVersion("v1");
        lead.setConsentAt(java.time.Instant.now());
        lead.setSource("site");
        lead.setStatus("new");
        return lead;
    }
}
