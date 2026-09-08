package ru.vedal.portal.admin.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Индекс Ведалины в админке.
 *
 * <p>В тестах индексация выключена — ключей эмбеддингов здесь нет и быть
 * не должно. Это и есть главное, что проверяется: дверь обязана отвечать
 * «выключено», а не падать и не притворяться, что индекс собран.
 */
@AutoConfigureMockMvc
class AdminKnowledgeApiTest extends PostgresTestBase {

    @Autowired
    MockMvc mvc;

    @Test
    void anonymousIsRefused() throws Exception {
        mvc.perform(get("/api/admin/v1/knowledge")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/admin/v1/knowledge/reindex")).andExpect(status().isUnauthorized());
    }

    // Спросить Ведалину имеет право любая роль портала. Пересобрать индекс
    // сайта — работа того, кто ведёт содержимое: каждый новый фрагмент
    // это вызов модели, то есть счёт.
    @Test
    @WithMockUser(username = "sales", roles = "PORTAL_SALES")
    void salesDoesNotRebuildTheSiteIndex() throws Exception {
        mvc.perform(get("/api/admin/v1/knowledge")).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/v1/knowledge/reindex")).andExpect(status().isForbidden());
    }

    // Выключенная индексация — рабочее состояние, а не поломка: пока корпуса
    // нет, ассистент отвечает поиском по словам. Дверь обязана это сказать,
    // а не ответить пятисотой и не показать пустой индекс, неотличимый
    // от собранного.
    @Test
    @WithMockUser(username = "production", roles = "PORTAL_PRODUCTION")
    void tellsThatIndexingIsOffInsteadOfFailing() throws Exception {
        mvc.perform(get("/api/admin/v1/knowledge"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.sources").value(0))
                .andExpect(jsonPath("$.rows").isEmpty());
    }

    // Нажатие на выключенном RAG — не пятисотая и не тихое «готово»:
    // 409 с объяснением, какие переменные включают индексацию.
    @Test
    @WithMockUser(username = "production", roles = "PORTAL_PRODUCTION")
    void refusesToReindexWhileIndexingIsOff() throws Exception {
        mvc.perform(post("/api/admin/v1/knowledge/reindex"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title",
                        org.hamcrest.Matchers.containsString("VEDAL_RAG_ENABLED")));
    }
}
