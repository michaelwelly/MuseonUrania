package ru.vedal.portal.content;

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
public class PublicNewsController {

    private final ContentQuery content;

    public PublicNewsController(ContentQuery content) {
        this.content = content;
    }

    @GetMapping("/news")
    public ResponseEntity<List<ContentQuery.Card>> news() {
        return cached(content.publishedNews());
    }

    @GetMapping("/news/{slug}")
    public ResponseEntity<ContentQuery.Article> article(@PathVariable String slug) {
        return cached(content.publishedArticle(slug));
    }

    private static <T> ResponseEntity<T> cached(T body) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(body);
    }
}
