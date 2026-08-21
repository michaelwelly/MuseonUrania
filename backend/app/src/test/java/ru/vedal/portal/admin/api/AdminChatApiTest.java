package ru.vedal.portal.admin.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;
import ru.vedal.portal.chat.ChatDesk;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Форма ответа списков разговоров.
//
// Тест написан после поломки, а не до неё, и это стоит записать. Двери чата
// отдавали Page из Spring Data вместо PageView, принятого в админке: снаружи
// это `content` и `pageable` вместо `items`, и экран падал на `items.length`
// у неопределённого значения. Компилятор такое не ловит — форма расходится
// только в JSON.
//
// Поэтому проверяются именно поля ответа, а не тип в сигнатуре.
@AutoConfigureMockMvc
class AdminChatApiTest extends PostgresTestBase {

    @Autowired
    MockMvc mvc;

    @Autowired
    ChatDesk desk;

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void listsAnswerInTheShapeTheAdminExpects() throws Exception {
        desk.say(UUID.randomUUID().toString(), "Сколько стоит инкубатор?",
                new ChatDesk.Context("ru", null, "/products/"));

        for (var url : new String[] {"/api/admin/v1/chats", "/api/admin/v1/chats/queue"}) {
            mvc.perform(get(url))
                    .andExpect(status().isOk())
                    // Именно items: на нём падал экран разговоров.
                    .andExpect(jsonPath("$.items").isArray())
                    .andExpect(jsonPath("$.page").exists())
                    .andExpect(jsonPath("$.size").exists())
                    .andExpect(jsonPath("$.total").exists())
                    .andExpect(jsonPath("$.pages").exists())
                    // Внутренностей пейджера Spring в контракте быть не должно.
                    .andExpect(jsonPath("$.content").doesNotExist())
                    .andExpect(jsonPath("$.pageable").doesNotExist());
        }
    }

    // Очередь — это работа: в неё попадают только те, кто ждёт живого ответа.
    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void queueHoldsOnlyThoseWaitingForAHuman() throws Exception {
        desk.say(UUID.randomUUID().toString(), "Сколько стоит инкубатор?",
                new ChatDesk.Context("ru", null, "/products/"));

        mvc.perform(get("/api/admin/v1/chats/queue"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].status").value("waiting"));
    }

    // Отбор по ответственному. Появился ради карточки сотрудника: до него
    // на месте числа разговоров стоял прочерк, потому что спросить было нечем.
    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void listTellsWhoseConversationsAreWhose() throws Exception {
        var взятый = desk.say(UUID.randomUUID().toString(), "Нужен сервис R1.",
                new ChatDesk.Context("ru", null, "/service/")).id();
        desk.say(UUID.randomUUID().toString(), "Сколько стоит инкубатор?",
                new ChatDesk.Context("ru", null, "/products/"));

        // Ответ и есть взятие: отдельной кнопки «взять» в портале нет.
        desk.reply(взятый, "irina", "Здравствуйте, смотрю вашу заявку.");

        mvc.perform(get("/api/admin/v1/chats?owner=irina"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].owner").value("irina"));

        // «-» — «никто не взял». У разговоров это не «ожидает уточнения»:
        // данных не не хватает, разговор просто ещё ничей.
        mvc.perform(get("/api/admin/v1/chats?owner=-"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].owner").doesNotExist());

        // Пустое значение — это «фильтра нет», а не «найти пустоту».
        mvc.perform(get("/api/admin/v1/chats").param("owner", "  "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(2));

        mvc.perform(get("/api/admin/v1/chats?owner=никто-такой"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0));
    }

    // Размер страницы без верхней границы означает «отдать всю таблицу
    // разговоров одним запросом» — и PageRequest.of ещё и падает на
    // отрицательной странице, превращая опечатку в адресе в 500.
    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void pageSizeIsBoundedAndNegativePageIsNotACrash() throws Exception {
        desk.say(UUID.randomUUID().toString(), "Сколько стоит инкубатор?",
                new ChatDesk.Context("ru", null, "/products/"));

        mvc.perform(get("/api/admin/v1/chats?size=1000000&page=-3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(200))
                .andExpect(jsonPath("$.page").value(0));
    }

    @Test
    void withoutATokenTheDoorIsClosed() throws Exception {
        mvc.perform(get("/api/admin/v1/chats")).andExpect(status().isUnauthorized());
    }
}
