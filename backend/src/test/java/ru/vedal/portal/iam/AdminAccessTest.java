package ru.vedal.portal.iam;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import ru.vedal.portal.PostgresTestBase;

import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Периметр портала после переезда админки на отдельное приложение.
//
// Главное здесь — проверки на отсутствие. Серверных страниц админки больше нет,
// а вместе с ними нет ни формы входа, ни cookie-сессии, ни CSRF-токена, который
// надо было бы защищать. Это убрало целый класс рисков, и тест сторожит именно
// это: вернувшийся @Controller с браузерной страницей должен уронить сборку,
// а не тихо завести второй периметр.
@AutoConfigureMockMvc
class AdminAccessTest extends PostgresTestBase {

    @Autowired
    MockMvc mvc;

    // Именно этот бин: рядом живёт controllerEndpointHandlerMapping от actuator,
    // и без квалификатора внедрение падает на двух подходящих кандидатах.
    @Autowired
    @Qualifier("requestMappingHandlerMapping")
    RequestMappingHandlerMapping mappings;

    @Test
    void portalServesNoBrowserPagesAtAll() {
        var browserRoutes = mappings.getHandlerMethods().keySet().stream()
                .filter(info -> info.getPathPatternsCondition() != null)
                .flatMap(info -> info.getPathPatternsCondition().getPatternValues().stream())
                .filter(path -> !path.startsWith("/api/"))
                .filter(path -> !path.startsWith("/actuator"))
                .filter(path -> !path.startsWith("/error"))
                // Swagger UI и спецификацию рисует springdoc, а не портал.
                // Это витрина контракта, а не страница под учётной записью:
                // в развёрнутых профилях она выключена целиком.
                .filter(path -> !path.startsWith("/swagger-ui"))
                .filter(path -> !path.startsWith("/v3/api-docs"))
                .collect(Collectors.toCollection(java.util.TreeSet::new));

        assertThat(browserRoutes)
                .as("у портала не должно остаться ни одной страницы для браузера")
                .isEmpty();
    }

    @Test
    void thereIsNoLoginFormLeft() throws Exception {
        // Форма входа принадлежала админке на Thymeleaf. Её отсутствие — часть
        // периметра: вход теперь только в Keycloak, и портал никого не пускает
        // по паролю через браузер.
        mvc.perform(get("/login")).andExpect(status().isForbidden());
        mvc.perform(get("/admin/products")).andExpect(status().isForbidden());
    }

    @Test
    void publicApiStaysOpen() throws Exception {
        mvc.perform(get("/api/public/v1/products")).andExpect(status().isOk());
    }

    // Именно 401, а не редирект: у двери правки клиент не браузер, которому
    // можно показать страницу входа.
    @Test
    void adminApiRefusesAnonymous() throws Exception {
        mvc.perform(get("/api/admin/v1/products")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "outsider", roles = "SOMETHING_ELSE")
    void adminApiRefusesTokenWithoutPortalRole() throws Exception {
        mvc.perform(get("/api/admin/v1/products")).andExpect(status().isForbidden());
    }

    // Сессии нет ни у одной двери, поэтому CSRF-токен не нужен и не требуется.
    // Проверка сторожит обратное: включённый обратно CSRF сломает и формы сайта,
    // и админку, а сломает молча — отказом на первой же отправке.
    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void mutationsDoNotRequireCsrfTokenBecauseThereIsNoSession() throws Exception {
        mvc.perform(post("/api/admin/v1/products")
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{}"))
                // 400 — тело не прошло валидацию. Важно, что это не 403:
                // до валидации запрос дошёл.
                .andExpect(status().isBadRequest());
    }
}
