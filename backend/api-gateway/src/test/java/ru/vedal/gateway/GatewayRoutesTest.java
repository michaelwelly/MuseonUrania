package ru.vedal.gateway;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import org.springframework.cloud.gateway.route.RouteDefinition;
import org.springframework.cloud.gateway.route.RouteDefinitionLocator;
import org.springframework.test.context.TestPropertySource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

// Маршруты шлюза — конфигурация, и ломаются они тихо: переставленные местами
// правила уводят двери правки в общий маршрут, а пропавший фильтр размера
// роняет загрузку документа с 413 до приложения.
//
// Тест смотрит на разобранные определения маршрутов, а не поднимает портал
// и сайт: проверяется порядок и состав, а не то, что HTTP работает.
@SpringBootTest
@TestPropertySource(properties = {
        "VEDAL_PORTAL_URL=http://portal.test:8081",
        "VEDAL_SITE_URL=http://site.test:3000"})
class GatewayRoutesTest {

    @Autowired
    RouteDefinitionLocator routes;

    private List<RouteDefinition> definitions() {
        return routes.getRouteDefinitions().collectList().block();
    }

    // Порядок — это и есть маршрутизация. /api/admin/** подходит и под /api/**,
    // поэтому частное правило обязано идти первым; переставленные местами,
    // они уведут двери правки в общий маршрут вместе с его лимитом тела.
    @Test
    void specificRoutesComeBeforeGeneralOnes() {
        var ids = definitions().stream().map(RouteDefinition::getId).toList();

        assertThat(ids).containsExactly(
                "portal-admin-api",
                "portal-public-api",
                "portal-openapi",
                "site");
    }

    @Test
    void everyApiRouteGoesToThePortalAndTheRestGoesToTheSite() {
        var byId = definitions().stream()
                .collect(java.util.stream.Collectors.toMap(RouteDefinition::getId, r -> r.getUri().toString()));

        assertThat(byId.get("portal-admin-api")).isEqualTo("http://portal.test:8081");
        assertThat(byId.get("portal-public-api")).isEqualTo("http://portal.test:8081");
        assertThat(byId.get("portal-openapi")).isEqualTo("http://portal.test:8081");
        assertThat(byId.get("site")).isEqualTo("http://site.test:3000");
    }

    // Предел тела на двери правки согласован с vedal.storage.max-file-size
    // портала: двадцать мегабайт на файл плюс запас на поля формы. Меньший
    // лимит здесь уронит загрузку до приложения, и редактор увидит страницу
    // шлюза вместо разбора причины; пропавший — пропустит что угодно.
    @Test
    void adminRouteKeepsTheBodyLimit() {
        var admin = definitions().stream()
                .filter(r -> r.getId().equals("portal-admin-api"))
                .findFirst()
                .orElseThrow();

        assertThat(admin.getFilters())
                .singleElement()
                .satisfies(filter -> {
                    assertThat(filter.getName()).isEqualTo("RequestSize");
                    assertThat(filter.getArgs()).containsValue("21MB");
                });
    }

    // Серверных страниц админки у портала больше нет, и маршрута к ним быть
    // не должно: /admin/** обслуживает сайт.
    @Test
    void thereIsNoRouteToServerRenderedAdminPages() {
        var predicates = definitions().stream()
                .flatMap(r -> r.getPredicates().stream())
                .flatMap(p -> p.getArgs().values().stream())
                .map(String::valueOf)
                .toList();

        assertThat(predicates).noneSatisfy(pattern ->
                assertThat(pattern).contains("/login"));
        assertThat(predicates).noneSatisfy(pattern ->
                assertThat(pattern).isEqualTo("/admin/**"));
    }
}
