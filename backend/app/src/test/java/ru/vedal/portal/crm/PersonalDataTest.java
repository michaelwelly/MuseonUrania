package ru.vedal.portal.crm;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.vedal.portal.PostgresTestBase;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Уничтожение персональных данных по обращению.
class PersonalDataTest extends PostgresTestBase {

    @Autowired
    PersonalData privacy;

    @Autowired
    LeadRepository leads;

    @Autowired
    ClientRepository clients;

    @Autowired
    InteractionRepository interactions;

    @Autowired
    org.springframework.context.ApplicationContext context;

    private Lead lead() {
        var lead = new Lead();
        lead.setId(UUID.randomUUID());
        // Номер уникален в базе, а в одном тесте заявок бывает две:
        // фиксированная строка сделала бы падение по дублю.
        lead.setNumber("З-тест-" + lead.getId().toString().substring(0, 8));
        lead.setForm("quote");
        lead.setName("Иванов Иван");
        lead.setCompany("ООО «Больница»");
        lead.setPhone("+7 900 000-00-00");
        lead.setEmail("ivanov@example.ru");
        lead.setSerialNumber("R2-2026-00417");
        lead.setMessage("Меня зовут Иванов Иван, мой телефон +7 900 000-00-00.");
        lead.setConsentVersion("v1");
        lead.setConsentAt(Instant.now());
        lead.setSource("site");
        lead.setStatus("new");
        lead.setLanguage("ru");
        lead.setCampaign("innoprom");
        return leads.save(lead);
    }

    private Interaction noteOn(UUID leadId) {
        var note = new Interaction();
        note.setId(UUID.randomUUID());
        note.setLeadId(leadId);
        note.setKind("call");
        note.setSubject("Разговор с Ивановым");
        note.setBody("Иван просил перезвонить на +7 900 000-00-00.");
        note.setActor("anna");
        return interactions.save(note);
    }

    @Test
    void erasesEveryFieldThatIdentifiesTheHuman() {
        var lead = lead();

        assertThat(privacy.eraseLead(lead.getId(), PersonalData.Basis.REQUEST, "anna")).isTrue();

        var after = leads.findById(lead.getId()).orElseThrow();
        assertThat(after.getName()).isEqualTo(PersonalData.ERASED);
        assertThat(after.getPhone()).isEqualTo(PersonalData.ERASED);
        assertThat(after.getEmail()).isEqualTo(PersonalData.ERASED);
        // Текст обращения человек пишет сам и волен указать там что угодно.
        assertThat(after.getMessage()).isEqualTo(PersonalData.ERASED);
    }

    // Заявка остаётся единицей учёта: иначе конверсия прошлого квартала
    // меняется сама собой каждый раз, когда кто-то просит себя удалить.
    @Test
    void keepsWhatAnalyticsCountsAndWhatIsNotPersonal() {
        var lead = lead();

        privacy.eraseLead(lead.getId(), PersonalData.Basis.REQUEST, "anna");

        var after = leads.findById(lead.getId()).orElseThrow();
        assertThat(after.getSource()).isEqualTo("site");
        assertThat(after.getLanguage()).isEqualTo("ru");
        assertThat(after.getCampaign()).isEqualTo("innoprom");
        assertThat(after.getForm()).isEqualTo("quote");
        // Организация персональными данными не является.
        assertThat(after.getCompany()).isEqualTo("ООО «Больница»");
        // Серийный номер — характеристика аппарата, а не человека, и стоит
        // в одном ряду с организацией. По нему видна история обслуживания
        // изделия, а опознать по нему человека нельзя — стирать его значило
        // бы обменять работающий сервис на ноль прибавки к защите данных.
        assertThat(after.getSerialNumber()).isEqualTo("R2-2026-00417");
    }

    // История переписки — носитель персональных данных не меньший, чем поля
    // карточки, и обычно более полный. Оставить её значит не выполнить
    // обращение, а сделать вид, что выполнил.
    @Test
    void erasesTheCorrespondenceToo() {
        var lead = lead();
        var note = noteOn(lead.getId());

        privacy.eraseLead(lead.getId(), PersonalData.Basis.REQUEST, "anna");

        var after = interactions.findById(note.getId()).orElseThrow();
        assertThat(after.getBody()).isEqualTo(PersonalData.ERASED);
        assertThat(after.getSubject()).isEqualTo(PersonalData.ERASED);
    }

    @Test
    void recordsWhenAndOnWhatGrounds() {
        var lead = lead();

        privacy.eraseLead(lead.getId(), PersonalData.Basis.REQUEST, "anna");

        var after = leads.findById(lead.getId()).orElseThrow();
        assertThat(after.getErasedAt()).isNotNull();
        assertThat(after.getErasureBasis()).isEqualTo(PersonalData.Basis.REQUEST.text());
    }

    // Обращение приходит дважды чаще, чем кажется: человек написал повторно,
    // сотрудник нажал повторно, автоочистка догнала уже обезличенное.
    @Test
    void secondRequestChangesNothingAndIsNotAnError() {
        var lead = lead();
        privacy.eraseLead(lead.getId(), PersonalData.Basis.REQUEST, "anna");
        var firstTime = leads.findById(lead.getId()).orElseThrow().getErasedAt();

        assertThat(privacy.eraseLead(lead.getId(), PersonalData.Basis.REQUEST, "anna")).isFalse();
        assertThat(leads.findById(lead.getId()).orElseThrow().getErasedAt()).isEqualTo(firstTime);
    }

    // У организации наименование — не персональные данные. Стерев его, мы
    // получили бы сделки, подписанные словом «удалено».
    @Test
    void keepsTheNameOfAnOrganisationButNotOfAPerson() {
        var company = client("company", "ООО «Больница»");
        var person = client("person", "Иванов Иван");

        privacy.eraseClient(company.getId(), PersonalData.Basis.REQUEST, "anna");
        privacy.eraseClient(person.getId(), PersonalData.Basis.REQUEST, "anna");

        assertThat(clients.findById(company.getId()).orElseThrow().getName())
                .isEqualTo("ООО «Больница»");
        assertThat(clients.findById(person.getId()).orElseThrow().getName())
                .isEqualTo(PersonalData.ERASED);
    }

    // Срок хранения не подтверждён заказчиком, а обезличивание необратимо.
    // Поэтому механизм есть, а бина нет: без свойства vedal.privacy.retention
    // класс не создаётся вовсе. Проверяется отсутствие бина, а не то, что он
    // «ничего не делает»: бин, который решает молчать, однажды решит иначе —
    // от опечатки в конфигурации или от чужой правки.
    @Test
    void retentionSweepDoesNotExistUntilTheTermIsConfirmed() {
        assertThat(context.getBeanNamesForType(RetentionSweep.class))
                .as("Автоочистка включается только явно заданным сроком хранения")
                .isEmpty();
    }

    @Test
    void unknownLeadIsRefusedRatherThanSilentlyIgnored() {
        assertThatThrownBy(() ->
                privacy.eraseLead(UUID.randomUUID(), PersonalData.Basis.REQUEST, "anna"))
                .hasMessageContaining("не найдена");
    }

    private Client client(String kind, String name) {
        var client = new Client();
        client.setId(UUID.randomUUID());
        client.setKind(kind);
        client.setName(name);
        client.setEmail("kontakt@example.ru");
        client.setPhone("+7 900 000-00-00");
        client.setNote("Звонить после обеда, спрашивать Ивана.");
        return clients.save(client);
    }
}
