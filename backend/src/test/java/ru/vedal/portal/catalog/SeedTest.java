package ru.vedal.portal.catalog;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.vedal.portal.PostgresTestBase;

import static org.assertj.core.api.Assertions.assertThat;

class SeedTest extends PostgresTestBase {

    // Позиций 12, а не 13, как в плане реализации: в frontend/content/products.ts
    // ровно 12 записей, и генератор переносит их один в один. «13» получается,
    // если считать «VEDAL R1, R2» за два изделия — это одна карточка каталога.
    private static final int CATALOG_SIZE = 12;

    @Autowired
    ProductRepository products;

    @Autowired
    CategoryRepository categories;

    @Test
    void catalogIsSeededFromFrontendData() {
        assertThat(categories.findAllByOrderByPositionAsc()).hasSize(5);
        assertThat(products.findByPublishedTrueOrderBySortOrderAscNameAsc()).hasSize(CATALOG_SIZE);
    }

    @Test
    void confirmedProductKeepsItsSpecs() {
        var r1 = products.findBySlugAndPublishedTrue("vedal-r1-r2").orElseThrow();

        assertThat(r1.getDocStatus()).isEqualTo("confirmed");
        assertThat(r1.getSpecs()).isNotEmpty();
        assertThat(r1.getCategories()).isNotEmpty();
    }
}
