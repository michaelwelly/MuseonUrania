package ru.vedal.portal.catalog;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.common.NotFoundException;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class CatalogService implements CatalogQuery {

    private final ProductRepository products;
    private final CategoryRepository categories;

    public CatalogService(ProductRepository products, CategoryRepository categories) {
        this.products = products;
        this.categories = categories;
    }

    @Override
    public List<PublicDto.CategoryView> categories() {
        return categories.findAllByOrderByPositionAsc().stream()
                .map(c -> new PublicDto.CategoryView(c.getSlug(), c.getName()))
                .toList();
    }

    @Override
    public List<PublicDto.Card> publishedProducts() {
        return products.findByPublishedTrueOrderBySortOrderAscNameAsc().stream()
                .map(CatalogService::toCard)
                .toList();
    }

    @Override
    public PublicDto.Detail publishedProduct(String slug) {
        // Неопубликованное для внешнего мира не существует: 404, а не 403 —
        // иначе по коду ответа видно, что такая позиция есть.
        var p = products.findBySlugAndPublishedTrue(slug)
                .orElseThrow(() -> new NotFoundException("Изделие не найдено"));
        return toDetail(p);
    }

    private static PublicDto.Card toCard(Product p) {
        return new PublicDto.Card(p.getSlug(), p.getName(), p.getKind(), p.getSummary(),
                p.getDocStatus(), names(p), p.getImageSrc(), p.getImageAlt());
    }

    private static PublicDto.Detail toDetail(Product p) {
        return new PublicDto.Detail(p.getSlug(), p.getName(), p.getKind(), p.getSummary(),
                p.getDetail(), p.getDocStatus(), names(p), p.getImageSrc(), p.getImageAlt(),
                specs(p, "key_param"), specs(p, "spec"));
    }

    private static List<String> names(Product p) {
        return p.getCategories().stream().map(Category::getName).toList();
    }

    private static List<PublicDto.SpecView> specs(Product p, String kind) {
        return p.getSpecs().stream()
                .filter(s -> kind.equals(s.getKind()))
                .map(s -> new PublicDto.SpecView(s.getLabel(), s.getValue(), s.isMuted()))
                .toList();
    }
}
