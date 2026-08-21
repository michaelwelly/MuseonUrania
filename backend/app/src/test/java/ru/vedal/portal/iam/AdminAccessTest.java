package ru.vedal.portal.iam;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpMethod;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import ru.vedal.portal.PostgresTestBase;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
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

    // Сплошная проверка периметра, а не выборка. Выше проверена одна дверь;
    // административных дверей больше семидесяти, и добавленная завтра
    // не должна оказаться открытой только потому, что её забыли вписать
    // в этот файл руками. Список маршрутов берётся у самого приложения.
    @Test
    void everyAdminEndpointRefusesAnonymous() throws Exception {
        var routes = adminRoutes();
        // Сторож самого теста: пустой список прошёл бы проверку ниже
        // и означал бы «периметр цел», не проверив ничего.
        assertThat(routes).as("периметр не может оказаться пустым").hasSizeGreaterThan(50);

        var reachable = new java.util.TreeSet<String>();
        for (var route : routes) {
            var status = mvc.perform(request(route.method(), route.path()))
                    .andReturn().getResponse().getStatus();
            // 401 — не представился, 403 — представился, но не тому.
            // Всё остальное значит, что запрос дошёл до приложения.
            if (status != 401 && status != 403) {
                reachable.add(status + " " + route.method() + " " + route.path());
            }
        }

        assertThat(reachable)
                .as("анонимный запрос обязан упереться в 401 или 403")
                .isEmpty();
    }

    // Токен есть, но роль чужая. Отдельная проверка: 401 и 403 стерегут разные
    // ошибки — первая ловит выпавшую дверь из-под аутентификации, вторая
    // дверь, которой хватает любого вошедшего.
    @Test
    @WithMockUser(username = "outsider", roles = "SOMETHING_ELSE")
    void everyAdminEndpointRefusesForeignRole() throws Exception {
        var reachable = new java.util.TreeSet<String>();
        for (var route : adminRoutes()) {
            var status = mvc.perform(request(route.method(), route.path()))
                    .andReturn().getResponse().getStatus();
            if (status != 403) {
                reachable.add(status + " " + route.method() + " " + route.path());
            }
        }

        assertThat(reachable)
                .as("чужая роль обязана упереться в 403")
                .isEmpty();
    }

    private record Route(HttpMethod method, String path) {
    }

    private List<Route> adminRoutes() {
        var routes = new ArrayList<Route>();
        for (var info : mappings.getHandlerMethods().keySet()) {
            var patterns = info.getPathPatternsCondition();
            if (patterns == null) {
                continue;
            }
            var methods = info.getMethodsCondition().getMethods();
            for (var pattern : patterns.getPatternValues()) {
                if (!pattern.startsWith("/api/admin/")) {
                    continue;
                }
                // Значение подставляется любое: до разбора пути запрос
                // не доходит — на пути стоит фильтр безопасности.
                var path = pattern.replaceAll("[{][^}]+[}]", "00000000-0000-0000-0000-000000000000");
                if (methods.isEmpty()) {
                    routes.add(new Route(HttpMethod.GET, path));
                } else {
                    for (var method : methods) {
                        routes.add(new Route(HttpMethod.valueOf(method.name()), path));
                    }
                }
            }
        }
        return routes;
    }
}
