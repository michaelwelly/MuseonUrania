package ru.vedal.portal.admin;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;
import ru.vedal.portal.catalog.ProductRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class AdminCatalogTest extends PostgresTestBase {

    @Autowired
    MockMvc mvc;

    @Autowired
    ProductRepository products;

    @Test
    @WithMockUser(username = "editor")
    void unpublishingHidesProductFromPublicApi() throws Exception {
        var product = products.findBySlugAndPublishedTrue("vedal-r1-r2").orElseThrow();

        mvc.perform(post("/admin/products/" + product.getId() + "/publish").with(csrf()))
                .andExpect(status().is3xxRedirection());

        assertThat(products.findBySlugAndPublishedTrue("vedal-r1-r2")).isEmpty();
    }

    @Test
    @WithMockUser(username = "editor")
    void editingSummaryPersists() throws Exception {
        var product = products.findAllByOrderBySortOrderAscNameAsc().getFirst();

        mvc.perform(post("/admin/products/" + product.getId())
                        .param("name", product.getName())
                        .param("kind", product.getKind())
                        .param("summary", "Обновлённое описание.")
                        .param("detail", "")
                        .param("docStatus", product.getDocStatus())
                        .with(csrf()))
                .andExpect(status().is3xxRedirection());

        assertThat(products.findById(product.getId()).orElseThrow().getSummary())
                .isEqualTo("Обновлённое описание.");
    }
}
