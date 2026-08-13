package ru.vedal.portal.catalog;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@Tag(name = "Каталог")
public class PublicCatalogController {

    private final CatalogQuery catalog;

    public PublicCatalogController(CatalogQuery catalog) {
        this.catalog = catalog;
    }

    @Operation(summary = "Категории каталога",
            description = "В порядке показа на сайте.")
    @ApiResponse(responseCode = "200", description = "Список категорий. Кэш пять минут.")
    @GetMapping("/categories")
    public ResponseEntity<List<PublicDto.CategoryView>> categories() {
        return cached(catalog.categories());
    }

    @Operation(summary = "Опубликованные изделия",
            description = "Только опубликованные — фильтр стоит в запросе к базе. "
                    + "Полный состав характеристик отдаёт карточка изделия.")
    @ApiResponse(responseCode = "200", description = "Список изделий. Кэш пять минут.")
    @GetMapping("/products")
    public ResponseEntity<List<PublicDto.Card>> products() {
        return cached(catalog.publishedProducts());
    }

    @Operation(summary = "Карточка изделия",
            description = "Неопубликованное изделие отдаёт `404`, а не пустую карточку: "
                    + "для внешнего мира его не существует.")
    @ApiResponse(responseCode = "200", description = "Карточка изделия. Кэш пять минут.")
    @ApiResponse(responseCode = "404", description = "Изделие не опубликовано или его нет.",
            content = @Content(mediaType = "application/problem+json",
                    schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
    @GetMapping("/products/{slug}")
    public ResponseEntity<PublicDto.Detail> product(
            @Parameter(description = "Идентификатор изделия в URL.", example = "vedal-r1-r2")
            @PathVariable String slug) {
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
