package ru.vedal.portal.catalog;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.vedal.portal.PostgresTestBase;
import ru.vedal.portal.documents.Document;
import ru.vedal.portal.documents.DocumentRepository;

import static org.assertj.core.api.Assertions.assertThat;

class SeedTest extends PostgresTestBase {

    // Каталог первого релиза: A-2000, R1, R2 и Т-100. Было двенадцать позиций,
    // девять из них сняты с публикации миграцией V20 — датащитов на них нет,
    // а карточка «VEDAL R1, R2» разделена на две отдельных.
    //
    // Проверяется именно опубликованное: снятые с сайта строки остались в базе
    // ради ссылок из КП и сделок, и findAll вернул бы все двенадцать.
    private static final int CATALOG_SIZE = 4;

    @Autowired
    ProductRepository products;

    @Autowired
    CategoryRepository categories;

    @Autowired
    DocumentRepository documents;

    @Test
    void catalogIsSeededFromFrontendData() {
        assertThat(categories.findAllByOrderByPositionAsc()).hasSize(5);
        assertThat(products.findByPublishedTrueOrderBySortOrderAscNameAsc()).hasSize(CATALOG_SIZE);
    }

    @Test
    void confirmedProductKeepsItsSpecs() {
        var r1 = products.findBySlugAndPublishedTrue("vedal-r1").orElseThrow();

        assertThat(r1.getDocStatus()).isEqualTo("confirmed");
        assertThat(r1.getSpecs()).isNotEmpty();
        assertThat(r1.getCategories()).isNotEmpty();
    }

    // Порядок задан заказчиком, а не алфавитом и не датой добавления.
    // Проверяется списком целиком: containsExactly ловит и лишнюю позицию,
    // и перестановку, тогда как hasSize(4) пропустил бы обе.
    @Test
    void catalogIsOrderedAsAgreedWithTheCustomer() {
        assertThat(products.findByPublishedTrueOrderBySortOrderAscNameAsc())
                .extracting(Product::getSlug)
                .containsExactly("vedal-a-2000", "vedal-r1", "vedal-r2", "vedal-t-100");
    }

    // Изделия уходят с сайта снятием с публикации, а не удалением: на
    // product.slug ссылаются позиции КП и сделки связью `on delete set null`,
    // и удаление строки молча обнулило бы предмет в уже выставленном КП.
    @Test
    void withdrawnProductIsHiddenButNotDeleted() {
        assertThat(products.findBySlugAndPublishedTrue("vedal-vv11")).isEmpty();

        assertThat(products.findAllByOrderBySortOrderAscNameAsc())
                .extracting(Product::getSlug)
                .contains("vedal-vv11", "vedal-n15", "vedal-vp4");
    }

    // R1 переименован из «vedal-r1-r2», а не создан заново — именно поэтому
    // ссылки документов уехали за ним каскадом. Создание новой карточки
    // оставило бы документы висеть на слаге, которого больше нет.
    @Test
    void splitRenamedR1AndCarriedDocumentLinksAlong() {
        assertThat(products.findBySlugAndPublishedTrue("vedal-r1-r2")).isEmpty();

        assertThat(documents.findAll())
                .extracting(Document::getProductSlug)
                .contains("vedal-r1")
                .doesNotContain("vedal-r1-r2");
    }

    // Датащит на две модели общий, но различает их явно: у R2 сверх набора R1
    // идут дисплей и опции, поэтому строк характеристик у него больше.
    @Test
    void r2CarriesItsOwnSpecsOnTopOfR1() {
        var r1 = products.findBySlugAndPublishedTrue("vedal-r1").orElseThrow();
        var r2 = products.findBySlugAndPublishedTrue("vedal-r2").orElseThrow();

        assertThat(r1.getSpecs()).extracting(ProductSpec::getLabel)
                .contains("Габариты", "Масса")
                .doesNotContain("Дисплей и управление", "Опции");
        assertThat(r2.getSpecs()).extracting(ProductSpec::getLabel)
                .contains("Дисплей и управление", "Опции");
    }
}
