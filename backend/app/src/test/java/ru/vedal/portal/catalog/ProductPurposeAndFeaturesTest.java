package ru.vedal.portal.catalog;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * §4.5 плана: места под назначение и ключевые особенности заведены пустыми
 * и заполняются через админку.
 */
@AutoConfigureMockMvc
class ProductPurposeAndFeaturesTest extends PostgresTestBase {

    @Autowired
    MockMvc mvc;

    @Autowired
    CatalogAdmin catalog;

    @Test
    void detailCarriesPurposeAndFeaturesInOrder() throws Exception {
        catalog.createProduct(form("feat-order", "Назначение изделия.",
                List.of("Первая особенность", "Вторая особенность")), "test");
        publish("feat-order");

        mvc.perform(get("/api/public/v1/products/feat-order"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.purpose").value("Назначение изделия."))
                // Порядок — часть смысла: особенности перечислены по важности,
                // и список, приехавший вперемешку, врёт о приоритетах.
                .andExpect(jsonPath("$.features[0]").value("Первая особенность"))
                .andExpect(jsonPath("$.features[1]").value("Вторая особенность"));
    }

    /**
     * Пустые места — штатное состояние до текстов от НН, а не ошибка.
     * Фронт по этим двум значениям решает, показать текст или «ожидает
     * уточнения», поэтому важно, что назначение приходит именно null,
     * а особенности — пустым массивом, а не null.
     */
    @Test
    void emptyPurposeIsNullAndEmptyFeaturesIsEmptyList() throws Exception {
        catalog.createProduct(form("feat-empty", "   ", List.of()), "test");
        publish("feat-empty");

        mvc.perform(get("/api/public/v1/products/feat-empty"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.purpose").doesNotExist())
                .andExpect(jsonPath("$.features").isArray())
                .andExpect(jsonPath("$.features").isEmpty());
    }

    /**
     * Повторное сохранение — то место, где ломается наивная реализация.
     *
     * Редактор не сливает списки по позициям, а чистит коллекцию и добавляет
     * строки заново. Hibernate в одной транзакции выполняет вставки раньше
     * удалений: новая строка с position = 0 записывается, пока старая ещё
     * не удалена. Будь на (product_id, position) уникальный индекс, вторая
     * правка особенностей падала бы — и падала бы только на второй, то есть
     * не у нас, а у редактора.
     */
    @Test
    void featuresCanBeReplacedAndCleared() {
        var created = catalog.createProduct(
                form("feat-replace", "Назначение.", List.of("Было первым", "Было вторым")), "test");

        var replaced = catalog.updateProduct(created.id(),
                form("feat-replace", created.version(), "Назначение.",
                        List.of("Стало единственным")), "test");
        assertThat(replaced.features()).containsExactly("Стало единственным");

        var cleared = catalog.updateProduct(created.id(),
                form("feat-replace", replaced.version(), "Назначение.", List.of()), "test");
        assertThat(cleared.features()).isEmpty();
    }

    private void publish(String slug) {
        var row = catalog.allProducts().stream()
                .filter(p -> slug.equals(p.slug()))
                .findFirst()
                .orElseThrow();
        catalog.setProductPublished(row.id(), true, "test");
    }

    private static CatalogAdmin.ProductForm form(String slug, String purpose, List<String> features) {
        return form(slug, null, purpose, features);
    }

    private static CatalogAdmin.ProductForm form(String slug, Long version, String purpose,
                                                 List<String> features) {
        return new CatalogAdmin.ProductForm(version, slug, "Тестовое изделие",
                "Тип изделия", "Краткое описание.", null, purpose, features,
                "pending", 0, null, null, List.of(), List.of(), List.of());
    }
}
