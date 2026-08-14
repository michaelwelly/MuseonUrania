package ru.vedal.portal.catalog;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
// В Boot 4 тестовые автоконфигурации переехали по модулям:
// было org.springframework.boot.test.autoconfigure.web.servlet.
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class PublicCatalogApiTest extends PostgresTestBase {

    @Autowired
    MockMvc mvc;

    @Autowired
    ProductRepository products;

    @Test
    void returnsOnlyPublishedProducts() throws Exception {
        products.save(product("api-visible", "Видимое", true));
        products.save(product("api-hidden", "Скрытое", false));

        mvc.perform(get("/api/public/v1/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.slug == 'api-visible')]").exists())
                .andExpect(jsonPath("$[?(@.slug == 'api-hidden')]").doesNotExist());
    }

    @Test
    void unpublishedProductIsNotFound() throws Exception {
        products.save(product("api-hidden-detail", "Скрытое", false));

        mvc.perform(get("/api/public/v1/products/api-hidden-detail"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Изделие не найдено"));
    }

    private static Product product(String slug, String name, boolean published) {
        var p = new Product();
        p.setId(UUID.randomUUID());
        p.setSlug(slug);
        p.setName(name);
        p.setKind("Тестовое изделие");
        p.setSummary("Тестовая позиция.");
        p.setDocStatus("pending");
        p.setPublished(published);
        return p;
    }
}
