package ru.vedal.portal.admin.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.vedal.portal.content.ContentAdmin;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/v1")
@Tag(name = "Админка: новости")
@SecurityRequirement(name = "keycloak")
public class AdminContentApi {

    private final ContentAdmin content;

    public AdminContentApi(ContentAdmin content) {
        this.content = content;
    }

    @Operation(summary = "Все материалы, включая черновики")
    @GetMapping("/news")
    public List<ContentAdmin.NewsRow> news() {
        return content.allNews();
    }

    @Operation(summary = "Рубрики",
            description = "Закрытый список из проверки в схеме. Админка рисует по нему выбор, "
                    + "а не свободное поле.")
    @GetMapping("/news/tags")
    public List<String> tags() {
        return ContentAdmin.TAGS;
    }

    @Operation(summary = "Материал целиком")
    @GetMapping("/news/{id}")
    public ContentAdmin.NewsView item(@PathVariable UUID id) {
        return content.news(id);
    }

    @Operation(summary = "Завести материал", description = "Создаётся черновиком.")
    @PostMapping("/news")
    public ResponseEntity<ContentAdmin.NewsView> create(
            @Valid @RequestBody ContentAdmin.NewsForm form, Authentication who) {
        var created = content.createNews(form, Actor.of(who));
        return ResponseEntity.created(URI.create("/api/admin/v1/news/" + created.id())).body(created);
    }

    @Operation(summary = "Правка материала")
    @PutMapping("/news/{id}")
    public ContentAdmin.NewsView update(@PathVariable UUID id,
                                        @Valid @RequestBody ContentAdmin.NewsForm form,
                                        Authentication who) {
        return content.updateNews(id, form, Actor.of(who));
    }

    @Operation(summary = "Опубликовать материал",
            description = "Без даты в ленте публикация отклоняется — это ограничение схемы "
                    + "news_published_needs_date.")
    @PostMapping("/news/{id}/publish")
    public ContentAdmin.NewsView publish(@PathVariable UUID id, Authentication who) {
        return content.setNewsPublished(id, true, Actor.of(who));
    }

    @Operation(summary = "Снять материал с публикации")
    @PostMapping("/news/{id}/unpublish")
    public ContentAdmin.NewsView unpublish(@PathVariable UUID id, Authentication who) {
        return content.setNewsPublished(id, false, Actor.of(who));
    }

    @Operation(summary = "Удалить материал",
            description = "Опубликованный материал сначала снимается с публикации: живая ссылка "
                    + "из рассылки не должна переставать открываться одним нажатием.")
    @DeleteMapping("/news/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id, Authentication who) {
        content.deleteNews(id, Actor.of(who));
        return ResponseEntity.noContent().build();
    }
}
