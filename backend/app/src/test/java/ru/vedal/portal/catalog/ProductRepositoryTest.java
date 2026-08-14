package ru.vedal.portal.catalog;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.vedal.portal.PostgresTestBase;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ProductRepositoryTest extends PostgresTestBase {

    @Autowired
    ProductRepository products;

    @Test
    void hidesUnpublishedProducts() {
        products.save(published("vedal-test-visible", "Видимое", 1));
        products.save(hidden("vedal-test-hidden", "Скрытое", 2));

        var slugs = products.findByPublishedTrueOrderBySortOrderAscNameAsc()
                .stream().map(Product::getSlug).toList();

        assertThat(slugs).contains("vedal-test-visible");
        assertThat(slugs).doesNotContain("vedal-test-hidden");
        assertThat(products.findBySlugAndPublishedTrue("vedal-test-hidden")).isEmpty();
    }

    private static Product published(String slug, String name, int order) {
        var p = base(slug, name, order);
        p.setPublished(true);
        return p;
    }

    private static Product hidden(String slug, String name, int order) {
        return base(slug, name, order);
    }

    private static Product base(String slug, String name, int order) {
        var p = new Product();
        p.setId(UUID.randomUUID());
        p.setSlug(slug);
        p.setName(name);
        p.setKind("Тестовое изделие");
        p.setSummary("Тестовая позиция, в каталоге не показывается.");
        p.setDocStatus("pending");
        p.setSortOrder(order);
        return p;
    }
}
