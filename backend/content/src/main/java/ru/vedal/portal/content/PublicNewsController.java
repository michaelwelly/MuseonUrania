package ru.vedal.portal.content;

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
@Tag(name = "Новости")
public class PublicNewsController {

    private final ContentQuery content;

    public PublicNewsController(ContentQuery content) {
        this.content = content;
    }

    @Operation(summary = "Лента материалов",
            description = "Только опубликованные, свежие сверху. Без текста материала — "
                    + "он приходит в отдельном запросе.")
    @ApiResponse(responseCode = "200", description = "Список материалов. Кэш пять минут.")
    @GetMapping("/news")
    public ResponseEntity<List<ContentQuery.Card>> news() {
        return cached(content.publishedNews());
    }

    @Operation(summary = "Материал целиком",
            description = "Неопубликованный материал отдаёт `404`.")
    @ApiResponse(responseCode = "200", description = "Материал. Кэш пять минут.")
    @ApiResponse(responseCode = "404", description = "Материал не опубликован или его нет.",
            content = @Content(mediaType = "application/problem+json",
                    schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
    @GetMapping("/news/{slug}")
    public ResponseEntity<ContentQuery.Article> article(
            @Parameter(description = "Идентификатор материала в URL.",
                    example = "postavka-v-perinatalnyy-centr")
            @PathVariable String slug) {
        return cached(content.publishedArticle(slug));
    }

    private static <T> ResponseEntity<T> cached(T body) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(body);
    }
}
