package ru.vedal.portal.admin.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;
import ru.vedal.portal.crm.LeadIntake;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Отбор списка заявок: поиск и фильтры.
//
// Появился под переделку админки, и появился на портале, а не в браузере.
// Разница принципиальная: отбор в браузере работает по загруженной странице,
// то есть по пятидесяти заявкам из сорока восьми тысяч, и на второй странице
// начинает молча врать — «ничего не найдено» там означает «на этой странице
// нет». Менеджер, ищущий человека по телефону, которым тот только что звонил,
// получает ответ «такого нет» про существующего клиента.
//
// Второй путь — «загрузить все и отобрать» — здесь закрыт вдвойне: это
// персональные данные, и выгружать базу целиком в браузер ради фильтра
// значит отдать её любому, кто открыл вкладку разработчика.
//
// Отдельный класс, а не строки в AdminCrmApiTest: там заявка — сырьё для
// сделки, здесь она сама предмет, и сид нужен свой.
@AutoConfigureMockMvc
class AdminLeadFilterTest extends PostgresTestBase {

    @Autowired
    MockMvc mvc;

    @Autowired
    LeadIntake intake;

    private UUID петров;
    private UUID кузнецова;

    @BeforeEach
    void seed() {
        // Четыре заявки, различающиеся каждым признаком отбора: если фильтр
        // перепутает поля, совпадение окажется не тем.
        петров = accept("filter-1", "quote", "Иван Петров", "ГКБ №1",
                "+7 343 555-22-11", "ivan@example.ru", "site", null);
        accept("filter-2", "consultation", "Мария Соколова", "Клиника Здоровье",
                "+7 812 100-20-30", "maria@clinic.ru", "yandex_form", null);
        accept("filter-3", "quote", "Пётр Иванов", null,
                "+7 495 777-88-99", "petr@mail.ru", "site", null);
        // Единственная с серийным номером. Остальные три — без него, и это
        // часть проверки: поиск по номеру не должен подбирать заявки, у
        // которых номера нет вовсе.
        кузнецова = accept("filter-4", "service", "Ольга Кузнецова", "Роддом №2",
                "+7 343 200-10-10", "olga@rd2.ru", "site", "R2-2026-00417");
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void searchFindsByNameIgnoringCase() throws Exception {
        // Менеджер набирает как слышал, а не как записано в карточке.
        list("query=соколовА")
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].name").value("Мария Соколова"));
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void searchFindsByCompanyAndSurvivesLeadsWithoutOne() throws Exception {
        // У третьей заявки компании нет вовсе. В SQL сравнение с null даёт
        // не «ложь», а «неизвестно», и неаккуратное условие выкидывает такие
        // строки из выдачи целиком — в том числе когда ищут по имени.
        list("query=ГКБ").andExpect(jsonPath("$.total").value(1));
        list("query=Пётр").andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].company").doesNotExist());
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void searchFindsByPhoneFragmentAndByEmail() throws Exception {
        // По куску номера — так его и ищут, копируя из списка.
        list("query=812").andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].name").value("Мария Соколова"));

        list("query=petr@").andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].email").value("petr@mail.ru"));
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void searchFindsBySerialNumber() throws Exception {
        // То, ради чего серийный номер стал колонкой, а не строкой в тексте
        // обращения: заказчик звонит и называет номер аппарата, а не своё имя.
        list("query=R2-2026-00417")
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].id").value(кузнецова.toString()));

        // Номер диктуют по телефону и записывают как придётся. Регистр здесь
        // такая же случайность, как в фамилии.
        list("query=r2-2026-00417").andExpect(jsonPath("$.total").value(1));

        // По куску номера — так его и ищут, копируя из письма.
        list("query=00417").andExpect(jsonPath("$.total").value(1));
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void leadsWithoutSerialNumberStayOutOfTheSearch() throws Exception {
        // Три заявки из четырёх без номера. В SQL сравнение с null даёт
        // не «ложь», а «неизвестно»: условие, написанное неаккуратно, либо
        // вернёт их все, либо выкинет из выдачи и те, что ищут по имени.
        list("query=R2-9999-00000").andExpect(jsonPath("$.total").value(0));
        list("query=Иван").andExpect(jsonPath("$.total").value(2));
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void blankSearchIsNoSearchAtAll() throws Exception {
        // Пустое поле поиска — это «показать всё», а не «найти пустоту».
        // Строка из пробелов приезжает с формы чаще, чем кажется: человек
        // стёр запрос, но остался пробел от разделения слов.
        list("query=").andExpect(jsonPath("$.total").value(4));

        // Через .param, а не через «query=%20%20» в адресе: MockMvc собирает
        // адрес через UriComponentsBuilder и кодирует его ещё раз, так что
        // до портала доезжает литерал «%20%20». Проверялась бы кодировка
        // тестового клиента, а не разбор пробелов на портале.
        mvc.perform(get("/api/admin/v1/leads").param("query", "  "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(4));
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void ownerFilterTellsMineFromNobodys() throws Exception {
        mvc.perform(post("/api/admin/v1/leads/" + петров + "/triage")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"in_progress\",\"owner\":\"irina\"}"))
                .andExpect(status().isOk());

        list("owner=irina").andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].owner").value("irina"));

        // «-» — это вопрос «что никто не ведёт», а не отсутствие фильтра.
        // Именно он отвечает на «чем заняться»: заявка без ответственного
        // не потеряна, но и не взята.
        list("owner=-").andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.items[0].owner").doesNotExist());

        list("owner=никто-такой").andExpect(jsonPath("$.total").value(0));
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void formAndSourceNarrowSeparately() throws Exception {
        list("form=quote").andExpect(jsonPath("$.total").value(2));
        list("source=yandex_form").andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].form").value("consultation"));
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void filtersAddUpInsteadOfReplacingEachOther() throws Exception {
        mvc.perform(post("/api/admin/v1/leads/" + петров + "/triage")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"in_progress\",\"owner\":\"irina\"}"))
                .andExpect(status().isOk());

        // Сохранённый фильтр менеджера — это и есть сочетание: «мои, в работе,
        // по запросам КП». Если признаки заменяют друг друга, а не сужают,
        // такой фильтр показывает чужое и выглядит при этом правдоподобно.
        list("owner=irina&status=in_progress&form=quote")
                .andExpect(jsonPath("$.total").value(1));

        // Тот же набор с одним несовпадающим признаком не даёт ничего.
        list("owner=irina&status=in_progress&form=contact")
                .andExpect(jsonPath("$.total").value(0));
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void pagingCountsTheWholeSelection() throws Exception {
        // Число под таблицей — «из скольких», а не «сколько на экране».
        // Оно считается по отбору, иначе «показаны 1–1 из 3» врёт про отбор,
        // в котором одна заявка.
        list("query=Иван&size=1")
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.pages").value(2));
    }

    private org.springframework.test.web.servlet.ResultActions list(String query) throws Exception {
        return mvc.perform(get("/api/admin/v1/leads?" + query)).andExpect(status().isOk());
    }

    private UUID accept(String key, String form, String name, String company,
                        String phone, String email, String source, String serialNumber) {
        return intake.accept(new LeadIntake.Draft(form, name, company, phone, email,
                "vedal-r1", serialNumber, "Прошу коммерческое предложение.", source,
                "ru", null), key).id();
    }
}
