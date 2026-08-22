package ru.vedal.portal.catalog;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.audit.AuditLog;
import ru.vedal.portal.common.ConflictException;
import ru.vedal.portal.common.NotFoundException;
import ru.vedal.portal.common.Versions;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// Правка каталога. Правила публикации и связности живут здесь, а не
// в контроллере: контроллер — это транспорт, и правило, записанное в нём,
// действует ровно до появления второго транспорта. Здесь оно действует
// для любого вызывающего: и для двери правки, и для импорта, и для теста.
@Service
public class CatalogEditor implements CatalogAdmin {

    private final ProductRepository products;
    private final CategoryRepository categories;
    private final AuditLog audit;

    public CatalogEditor(ProductRepository products, CategoryRepository categories, AuditLog audit) {
        this.products = products;
        this.categories = categories;
        this.audit = audit;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductRow> allProducts() {
        return products.findAllByOrderBySortOrderAscNameAsc().stream()
                .map(p -> new ProductRow(p.getId(), p.getSlug(), p.getName(), p.getKind(),
                        p.getSummary(), p.getDocStatus(), p.isPublished(), p.getSortOrder(),
                        p.getImageSrc(),
                        p.getCategories().stream().map(Category::getName).toList(),
                        p.getUpdatedAt()))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ProductView product(UUID id) {
        return view(find(id));
    }

    @Override
    @Transactional
    public ProductView createProduct(ProductForm form, String actor) {
        if (products.existsBySlug(form.slug())) {
            throw new ConflictException("Изделие с таким slug уже есть: " + form.slug());
        }

        var product = new Product();
        product.setId(UUID.randomUUID());
        product.setCreatedAt(Instant.now());
        // Новое изделие невидимо снаружи, пока редактор не опубликует его
        // отдельным действием. Черновик, случайно уехавший на сайт, снимается
        // дольше, чем публикуется.
        product.setPublished(false);
        apply(product, form);
        products.save(product);

        audit.record(actor, "product.create", "product", product.getSlug(),
                Map.of("docStatus", product.getDocStatus()));
        return view(product);
    }

    @Override
    @Transactional
    public ProductView updateProduct(UUID id, ProductForm form, String actor) {
        var product = find(id);
        Versions.check(form.version(), product.getVersion(), "Изделие");

        // Смена slug'а у опубликованного изделия обрывает все внешние ссылки
        // на карточку — включая те, что уже проиндексированы и разосланы
        // в коммерческих предложениях. Снять с публикации, переименовать,
        // опубликовать заново — осознанная последовательность, а не побочный
        // эффект правки текста.
        if (product.isPublished() && !product.getSlug().equals(form.slug())) {
            throw new ConflictException(
                    "Опубликованное изделие нельзя переименовать: адрес карточки "
                            + "/products/" + product.getSlug() + " перестанет открываться. "
                            + "Снимите с публикации, поменяйте slug, опубликуйте заново.");
        }
        if (!product.getSlug().equals(form.slug()) && products.existsBySlug(form.slug())) {
            throw new ConflictException("Изделие с таким slug уже есть: " + form.slug());
        }

        apply(product, form);
        products.saveAndFlush(product);

        audit.record(actor, "product.edit", "product", product.getSlug(),
                Map.of("docStatus", product.getDocStatus()));
        return view(product);
    }

    @Override
    @Transactional
    public ProductView setProductPublished(UUID id, boolean published, String actor) {
        var product = find(id);
        if (product.isPublished() == published) return view(product);

        product.setPublished(published);
        product.setUpdatedAt(Instant.now());
        products.save(product);

        // Пишем в той же транзакции, что и само изменение: видимость изделия
        // на сайте меняется здесь, и запись об этом не должна разойтись с фактом.
        audit.record(actor, published ? "product.publish" : "product.unpublish",
                "product", product.getSlug(), Map.of());
        return view(product);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CategoryView> allCategories() {
        return categories.findAllByOrderByPositionAsc().stream()
                .map(c -> new CategoryView(c.getId(), c.getSlug(), c.getName(), c.getPosition(),
                        products.countByCategoriesId(c.getId())))
                .toList();
    }

    @Override
    @Transactional
    public CategoryView createCategory(CategoryForm form, String actor) {
        if (categories.existsBySlug(form.slug())) {
            throw new ConflictException("Категория с таким slug уже есть: " + form.slug());
        }

        var category = new Category();
        category.setId(UUID.randomUUID());
        category.setSlug(form.slug());
        category.setName(form.name());
        category.setPosition(form.position());
        categories.save(category);

        audit.record(actor, "category.create", "category", category.getSlug(), Map.of());
        return new CategoryView(category.getId(), category.getSlug(), category.getName(),
                category.getPosition(), 0);
    }

    @Override
    @Transactional
    public CategoryView updateCategory(UUID id, CategoryForm form, String actor) {
        var category = categories.findById(id)
                .orElseThrow(() -> new NotFoundException("Категория не найдена"));
        category.setSlug(form.slug());
        category.setName(form.name());
        category.setPosition(form.position());
        categories.save(category);

        audit.record(actor, "category.edit", "category", category.getSlug(), Map.of());
        return allCategories().stream()
                .filter(c -> c.id().equals(id))
                .findFirst()
                .orElseThrow();
    }

    @Override
    @Transactional
    public void deleteCategory(UUID id, String actor) {
        var category = categories.findById(id)
                .orElseThrow(() -> new NotFoundException("Категория не найдена"));

        // В схеме на product_category стоит on delete restrict — база откажет
        // сама. Проверяем заранее, чтобы редактор увидел причину и число
        // изделий, а не страницу ошибки с именем внешнего ключа.
        var used = products.countByCategoriesId(id);
        if (used > 0) {
            throw new ConflictException("Категорию нельзя удалить: в ней " + used
                    + " изделий. Сначала переназначьте их.");
        }

        categories.delete(category);
        audit.record(actor, "category.delete", "category", category.getSlug(), Map.of());
    }

    private void apply(Product product, ProductForm form) {
        product.setSlug(form.slug());
        product.setName(form.name());
        product.setKind(form.kind());
        product.setSummary(form.summary());
        product.setDetail(blankToNull(form.detail()));
        product.setPurpose(blankToNull(form.purpose()));
        product.setDocStatus(form.docStatus());
        product.setSortOrder(form.sortOrder());
        product.setImageSrc(blankToNull(form.imageSrc()));
        product.setImageAlt(blankToNull(form.imageAlt()));
        product.setUpdatedAt(Instant.now());

        product.getCategories().clear();
        for (var slug : nullToEmpty(form.categorySlugs())) {
            product.getCategories().add(categories.findBySlug(slug)
                    .orElseThrow(() -> new NotFoundException("Категория не найдена: " + slug)));
        }

        // Характеристики заменяются целиком, а не сливаются по позициям:
        // редактор видит их одним списком и удаляет строку удалением строки.
        // orphanRemoval убирает осиротевшие записи.
        product.getSpecs().clear();
        addSpecs(product, "key_param", nullToEmpty(form.keyParams()));
        addSpecs(product, "spec", nullToEmpty(form.specs()));

        // Особенности — тем же приёмом и по той же причине.
        product.getFeatures().clear();
        var featurePosition = 0;
        for (var body : nullToEmpty(form.features())) {
            var feature = new ProductFeature();
            feature.setId(UUID.randomUUID());
            feature.setPosition(featurePosition++);
            feature.setBody(body);
            product.getFeatures().add(feature);
        }
    }

    private static void addSpecs(Product product, String kind, List<SpecForm> rows) {
        var position = 0;
        for (var row : rows) {
            var spec = new ProductSpec();
            spec.setId(UUID.randomUUID());
            spec.setKind(kind);
            spec.setPosition(position++);
            spec.setLabel(row.label());
            spec.setValue(row.value());
            spec.setMuted(row.muted());
            product.getSpecs().add(spec);
        }
    }

    private static ProductView view(Product p) {
        return new ProductView(p.getId(), p.getVersion(), p.getSlug(), p.getName(), p.getKind(), p.getSummary(),
                p.getDetail(), p.getPurpose(),
                p.getFeatures().stream().map(ProductFeature::getBody).toList(),
                p.getDocStatus(), p.isPublished(), p.getSortOrder(),
                p.getImageSrc(), p.getImageAlt(),
                p.getCategories().stream().map(Category::getSlug).toList(),
                specs(p, "key_param"), specs(p, "spec"),
                p.getCreatedAt(), p.getUpdatedAt());
    }

    private static List<SpecView> specs(Product p, String kind) {
        return p.getSpecs().stream()
                .filter(s -> kind.equals(s.getKind()))
                .map(s -> new SpecView(s.getLabel(), s.getValue(), s.isMuted()))
                .toList();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static <T> List<T> nullToEmpty(List<T> value) {
        return value == null ? List.of() : value;
    }

    private Product find(UUID id) {
        return products.findById(id).orElseThrow(() -> new NotFoundException("Изделие не найдено"));
    }
}
