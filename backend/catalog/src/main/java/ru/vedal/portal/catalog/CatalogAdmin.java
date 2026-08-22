package ru.vedal.portal.catalog;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

// Вторая дверь модуля — для редактора, в отличие от CatalogQuery, который
// показывает только опубликованное. Соседи ходят через интерфейс, а не
// в ProductRepository: цена за то, чтобы каталог можно было вынуть в отдельный
// сервис, не распутывая клубок.
public interface CatalogAdmin {

    // Идентификатор в URL. Кириллицу и пробелы не принимаем: slug попадает
    // в адрес страницы и в ключ файла, и «Инкубатор А-2000» в обоих местах
    // означает беду.
    String SLUG_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

    @Schema(name = "AdminProductRow", description = "Строка списка изделий в админке. "
            + "Показывает и неопубликованное — в этом её отличие от публичного каталога.")
    record ProductRow(UUID id, String slug, String name, String kind, String summary,
                      String docStatus, boolean published, int sortOrder,

                      @Schema(description = "Снимок изделия. Пусто — снимка нет, "
                              + "и это состояние, а не пропуск в ответе: изделие без "
                              + "снимка выглядит на сайте пустой рамкой, и редактор "
                              + "должен видеть такие в списке, не открывая каждое.",
                              nullable = true)
                      String imageSrc,

                      List<String> categories, Instant updatedAt) {}

    @Schema(name = "AdminProduct", description = "Изделие целиком, как его правит редактор.")
    record ProductView(UUID id,
                       @Schema(description = "Версия карточки. Её надо вернуть в форме правки — "
                               + "по ней портал отличает «правлю то, что прочитал» от «правлю "
                               + "то, что за это время поменял кто-то другой».")
                       long version,
                       String slug, String name, String kind, String summary, String detail,
                       String purpose, List<String> features,
                       String docStatus, boolean published, int sortOrder,
                       String imageSrc, String imageAlt,
                       List<String> categorySlugs,
                       List<SpecView> keyParams, List<SpecView> specs,
                       Instant createdAt, Instant updatedAt) {}

    @Schema(name = "AdminProductSpec", description = "Строка характеристик.")
    record SpecView(String label, String value, boolean muted) {}

    @Schema(name = "AdminProductForm", description = """
            Правка изделия. Поля `published` здесь нет намеренно: публикация —
            отдельное действие, а не поле формы. Снятие с публикации убирает
            изделие с сайта, и это не должно случаться заодно с правкой текста.
            """)
    record ProductForm(

            @Schema(description = "Версия карточки, прочитанная перед правкой. Обязательна "
                    + "при обновлении, при создании игнорируется. Форма без версии "
                    + "отклоняется: сохранить вслепую значит затереть чужую правку.",
                    example = "3", nullable = true)
            Long version,

            @Schema(description = "Идентификатор в URL. Только латиница, цифры и дефис.",
                    example = "vedal-a-2000")
            @NotBlank @Pattern(regexp = SLUG_PATTERN,
                    message = "Только латиница в нижнем регистре, цифры и дефис")
            String slug,

            @NotBlank @Size(max = 200) String name,

            @Schema(description = "Тип изделия строкой, как он показан на карточке.",
                    example = "Инкубатор-трансформер")
            @NotBlank @Size(max = 200) String kind,

            @Schema(description = "Короткое описание для карточки в списке.")
            @NotBlank @Size(max = 1000) String summary,

            @Schema(description = "Развёрнутое описание. Пусто — карточка покажет только summary.",
                    nullable = true)
            @Size(max = 20000) String detail,

            @Schema(description = "Назначение: в каких отделениях и для каких задач применяется "
                    + "изделие. Пусто — карточка покажет «ожидает уточнения».",
                    nullable = true)
            @Size(max = 20000) String purpose,

            @Schema(description = "Ключевые особенности, по одному утверждению в строке. Пусто — "
                    + "карточка покажет «ожидает уточнения».")
            List<@NotBlank @Size(max = 500) String> features,

            @Schema(description = "Подтверждены ли характеристики датащитом. Это НЕ видимость "
                    + "на сайте: бейдж рисуется по нему, а показ — по published.",
                    allowableValues = {"confirmed", "pending"})
            @NotBlank @Pattern(regexp = "confirmed|pending") String docStatus,

            int sortOrder,

            @Schema(description = "Путь к снимку в медиа-хранилище, без хоста: имя хоста — "
                    + "свойство окружения, и в данных ему не место.",
                    example = "/photos/products/vedal-a-2000.jpg", nullable = true)
            @Size(max = 500) String imageSrc,

            @Size(max = 500) String imageAlt,

            @Schema(description = "Категории каталога по slug'ам.")
            List<@NotBlank String> categorySlugs,

            @Schema(description = "Четыре строки под заголовком карточки.")
            List<@Valid SpecForm> keyParams,

            @Schema(description = "Таблица характеристик на вкладке изделия.")
            List<@Valid SpecForm> specs) {}

    @Schema(name = "AdminProductSpecForm")
    record SpecForm(@NotBlank @Size(max = 200) String label,
                    @NotBlank @Size(max = 500) String value,
                    boolean muted) {}

    @Schema(name = "AdminCategory")
    record CategoryView(UUID id, String slug, String name, int position, long productCount) {}

    @Schema(name = "AdminCategoryForm")
    record CategoryForm(
            @NotBlank @Pattern(regexp = SLUG_PATTERN,
                    message = "Только латиница в нижнем регистре, цифры и дефис")
            String slug,
            @NotBlank @Size(max = 200) String name,
            int position) {}

    List<ProductRow> allProducts();

    ProductView product(UUID id);

    ProductView createProduct(ProductForm form, String actor);

    ProductView updateProduct(UUID id, ProductForm form, String actor);

    ProductView setProductPublished(UUID id, boolean published, String actor);

    List<CategoryView> allCategories();

    CategoryView createCategory(CategoryForm form, String actor);

    CategoryView updateCategory(UUID id, CategoryForm form, String actor);

    void deleteCategory(UUID id, String actor);
}
