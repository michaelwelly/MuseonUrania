package ru.vedal.portal.catalog;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

@RestController
@RequestMapping("/api/public/v1")
public class PublicCatalogController {

    private final CatalogQuery catalog;

    public PublicCatalogController(CatalogQuery catalog) {
        this.catalog = catalog;
    }

    @GetMapping("/categories")
    public ResponseEntity<List<PublicDto.CategoryView>> categories() {
        return cached(catalog.categories());
    }

    @GetMapping("/products")
    public ResponseEntity<List<PublicDto.Card>> products() {
        return cached(catalog.publishedProducts());
    }

    @GetMapping("/products/{slug}")
    public ResponseEntity<PublicDto.Detail> product(@PathVariable String slug) {
        return cached(catalog.publishedProduct(slug));
    }

    // Сборка сайта ходит сюда пачкой запросов — пусть кэшируется на стороне
    // клиента и прокси, а не бьёт в базу каждый раз.
    private static <T> ResponseEntity<T> cached(T body) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(body);
    }
}
