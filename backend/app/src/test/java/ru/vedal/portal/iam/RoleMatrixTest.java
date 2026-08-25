package ru.vedal.portal.iam;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Кто куда пущен.
//
// Ролей стало три, и делят они не действия, а контуры: продажи, содержимое
// сайта и всё сразу. До этого их было две, portal-admin и portal-editor,
// и одно правило hasAnyRole пускало обе ко всему — то есть тот, кто пришёл
// править карточку изделия, получал клиентскую базу, суммы сделок
// и переписку с посетителями.
//
// ───────────────────────────────────────────────────────────────────────────
// Почему это проверяется дверь за дверью, а не «в целом»
//
// Правило доступа ломается тихо. Забытая дверь не падает и не пишет в журнал —
// она просто отвечает тому, кому не должна, и выглядит это ровно как рабочая
// система. Один запрос на контур не годится: правила заданы списком путей,
// и выпасть из списка может любой отдельный.
//
// Проверяется обе стороны каждого правила: что пущен тот, кто должен,
// И что не пущен тот, кто не должен. Половина проверки — это проверка,
// которая зеленеет от снятой защиты.
@AutoConfigureMockMvc
class RoleMatrixTest extends PostgresTestBase {

    @Autowired
    MockMvc mvc;

    // Двери закрытого контура продаж: клиентская база, суммы, переписка.
    private static final String[] ПРОДАЖИ = {
            "/api/admin/v1/leads",
            "/api/admin/v1/clients",
            "/api/admin/v1/deals",
            "/api/admin/v1/quotes",
            "/api/admin/v1/chats",
            "/api/admin/v1/analytics",
            "/api/admin/v1/analytics/dimensions",
    };

    // Двери содержимого сайта: то, что уходит наружу.
    private static final String[] СОДЕРЖИМОЕ = {
            "/api/admin/v1/products",
            "/api/admin/v1/categories",
            "/api/admin/v1/news",
            "/api/admin/v1/documents",
    };

    // Двери, которые не нужны для работы ни одного контура.
    private static final String[] ТОЛЬКО_АДМИН = {
            "/api/admin/v1/audit",
    };

    // ————— продажи —————

    @Test
    @WithMockUser(username = "sales", roles = "PORTAL_SALES")
    void salesGetsTheSalesContour() throws Exception {
        for (var дверь : ПРОДАЖИ) {
            mvc.perform(get(дверь)).andExpect(status().isOk());
        }
    }

    @Test
    @WithMockUser(username = "sales", roles = "PORTAL_SALES")
    void salesDoesNotEditTheSite() throws Exception {
        for (var дверь : СОДЕРЖИМОЕ) {
            mvc.perform(get(дверь)).andExpect(status().isForbidden());
        }
    }

    @Test
    @WithMockUser(username = "sales", roles = "PORTAL_SALES")
    void salesDoesNotSeeTheJournal() throws Exception {
        for (var дверь : ТОЛЬКО_АДМИН) {
            mvc.perform(get(дверь)).andExpect(status().isForbidden());
        }
    }

    // Справочник сотрудников — исключение, и оно рабочее, а не уступка.
    // Сначала он был закрыт администратором, и без него продажи не выбрали
    // бы ответственного ни у заявки, ни у сделки: поле «ответственный»
    // берёт список отсюда. Отдаётся логин, имя и «работает» — ни клиентов,
    // ни сумм, ни персональных данных посетителей.
    @Test
    @WithMockUser(username = "sales", roles = "PORTAL_SALES")
    void everyRoleMayPickAnOwnerFromTheStaffDirectory() throws Exception {
        mvc.perform(get("/api/admin/v1/staff")).andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "production", roles = "PORTAL_PRODUCTION")
    void theSiteEditorAlsoResolvesLoginsToNames() throws Exception {
        // Приветствие на сводке и подписи в журнале превращают логин в имя
        // тем же справочником. Без него человек здоровается сам с собой
        // по логину.
        mvc.perform(get("/api/admin/v1/staff")).andExpect(status().isOk());
    }

    // ————— содержимое сайта —————

    @Test
    @WithMockUser(username = "production", roles = "PORTAL_PRODUCTION")
    void productionGetsTheSiteContent() throws Exception {
        for (var дверь : СОДЕРЖИМОЕ) {
            mvc.perform(get(дверь)).andExpect(status().isOk());
        }
    }

    @Test
    @WithMockUser(username = "production", roles = "PORTAL_PRODUCTION")
    void productionNeverSeesTheClientBase() throws Exception {
        // Это главное правило всей раскладки. Клиентская база и коммерческие
        // условия отнесены брифом собственника к тому, что наружу не выносим,
        // а «наружу» начинается с лишнего человека внутри.
        for (var дверь : ПРОДАЖИ) {
            mvc.perform(get(дверь)).andExpect(status().isForbidden());
        }
    }

    // ————— администратор —————

    @Test
    @WithMockUser(username = "boss", roles = "PORTAL_ADMIN")
    void adminGetsEverything() throws Exception {
        for (var дверь : ПРОДАЖИ) {
            mvc.perform(get(дверь)).andExpect(status().isOk());
        }
        for (var дверь : СОДЕРЖИМОЕ) {
            mvc.perform(get(дверь)).andExpect(status().isOk());
        }
        for (var дверь : ТОЛЬКО_АДМИН) {
            mvc.perform(get(дверь)).andExpect(status().isOk());
        }
    }

    // ————— общее для вошедших —————

    @Test
    @WithMockUser(username = "production", roles = "PORTAL_PRODUCTION")
    void everyoneSignedInMaySeeWhoTheyAre() throws Exception {
        // Оболочка спрашивает это на каждой странице. Закрыв дверь ролью,
        // мы закрыли бы вход тому, у кого роль есть, но другая.
        mvc.perform(get("/api/admin/v1/session")).andExpect(status().isOk());
    }

    // Имя роли, которое отдаёт /session, — это то, по чему админка решает,
    // какие разделы показать. Разойдись форма записи, и человек с полными
    // правами увидит пустую оболочку: портал его пустит, а интерфейс
    // не предложит ни одной двери.
    @Test
    @WithMockUser(username = "boss", roles = "PORTAL_ADMIN")
    void sessionReportsRolesTheWayTheAdminPanelReadsThem() throws Exception {
        mvc.perform(get("/api/admin/v1/session"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roles").value(contains("portal-admin")));
    }

    @Test
    @WithMockUser(username = "sales", roles = "PORTAL_SALES")
    void salesSeesItsOwnRoleAndNothingElse() throws Exception {
        mvc.perform(get("/api/admin/v1/session"))
                .andExpect(jsonPath("$.roles").value(contains("portal-sales")));
    }

    // Приставка Spring и области видимости токена наружу не уходят.
    // Проверяется отдельно: тест выше зеленел бы и на списке, где рядом
    // с portal-admin лежат ROLE_PORTAL_ADMIN и десяток SCOPE_*.
    @Test
    @WithMockUser(username = "boss", roles = {"PORTAL_ADMIN", "PORTAL_SALES"})
    void neitherSpringPrefixNorScopesLeakOutward() throws Exception {
        mvc.perform(get("/api/admin/v1/session"))
                .andExpect(jsonPath("$.roles").value(
                        containsInAnyOrder("portal-admin", "portal-sales")));
    }

    // ————— уничтожение персональных данных —————

    @Test
    @WithMockUser(username = "sales", roles = "PORTAL_SALES")
    void erasingPersonalDataIsNotASalesButton() throws Exception {
        // Дверь лежит под /leads/**, куда продажам вход открыт, и без
        // отдельного правила ВЫШЕ остальных она досталась бы им вместе
        // с контуром. Отменить нажатие этой кнопки нельзя ничем.
        mvc.perform(delete("/api/admin/v1/leads/" + UUID.randomUUID() + "/personal-data"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "boss", roles = "PORTAL_ADMIN")
    void erasingPersonalDataIsAnAdminButton() throws Exception {
        // Не 403: заявки с таким идентификатором нет, и это уже разговор
        // домена, а не охраны. Важно, что до домена запрос дошёл.
        mvc.perform(delete("/api/admin/v1/leads/" + UUID.randomUUID() + "/personal-data"))
                .andExpect(status().isNotFound());
    }

    // ————— без роли и без токена —————

    @Test
    @WithMockUser(username = "outsider", roles = "SOMETHING_ELSE")
    void aTokenWithoutAPortalRoleOpensNothing() throws Exception {
        mvc.perform(get("/api/admin/v1/products")).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/v1/leads")).andExpect(status().isForbidden());
        // И собственное имя тоже: у токена соседнего клиента realm'а
        // за админской дверью дел нет никаких.
        mvc.perform(get("/api/admin/v1/session")).andExpect(status().isForbidden());
    }

    @Test
    void withoutATokenEveryDoorIsClosed() throws Exception {
        mvc.perform(get("/api/admin/v1/products")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/v1/leads")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/v1/session")).andExpect(status().isUnauthorized());
    }
}
