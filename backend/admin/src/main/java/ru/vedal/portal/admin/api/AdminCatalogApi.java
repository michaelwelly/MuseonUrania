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
import ru.vedal.portal.catalog.CatalogAdmin;

import java.net.URI;
import java.util.List;
import java.util.UUID;

// Каталог глазами редактора. Публичная дверь отдаёт только опубликованное,
// эта — всё, включая черновики.
@RestController
@RequestMapping("/api/admin/v1")
@Tag(name = "Админка: каталог")
@SecurityRequirement(name = "keycloak")
public class AdminCatalogApi {

    private final CatalogAdmin catalog;

    public AdminCatalogApi(CatalogAdmin catalog) {
        this.catalog = catalog;
    }

    @Operation(summary = "Все изделия, включая неопубликованные")
    @GetMapping("/products")
    public List<CatalogAdmin.ProductRow> products() {
        return catalog.allProducts();
    }

    @Operation(summary = "Изделие целиком")
    @GetMapping("/products/{id}")
    public CatalogAdmin.ProductView product(@PathVariable UUID id) {
        return catalog.product(id);
    }

    @Operation(summary = "Завести изделие",
            description = "Создаётся неопубликованным. Публикация — отдельным действием.")
    @PostMapping("/products")
    public ResponseEntity<CatalogAdmin.ProductView> create(
            @Valid @RequestBody CatalogAdmin.ProductForm form, Authentication who) {
        var created = catalog.createProduct(form, Actor.of(who));
        return ResponseEntity.created(URI.create("/api/admin/v1/products/" + created.id()))
                .body(created);
    }

    @Operation(summary = "Правка изделия",
            description = "Переименование опубликованного изделия отклоняется: адрес карточки "
                    + "уже разослан и проиндексирован.")
    @PutMapping("/products/{id}")
    public CatalogAdmin.ProductView update(@PathVariable UUID id,
                                           @Valid @RequestBody CatalogAdmin.ProductForm form,
                                           Authentication who) {
        return catalog.updateProduct(id, form, Actor.of(who));
    }

    @Operation(summary = "Опубликовать изделие")
    @PostMapping("/products/{id}/publish")
    public CatalogAdmin.ProductView publish(@PathVariable UUID id, Authentication who) {
        return catalog.setProductPublished(id, true, Actor.of(who));
    }

    @Operation(summary = "Снять изделие с публикации",
            description = "Изделие сразу пропадает с сайта. Данные остаются.")
    @PostMapping("/products/{id}/unpublish")
    public CatalogAdmin.ProductView unpublish(@PathVariable UUID id, Authentication who) {
        return catalog.setProductPublished(id, false, Actor.of(who));
    }

    @Operation(summary = "Категории каталога")
    @GetMapping("/categories")
    public List<CatalogAdmin.CategoryView> categories() {
        return catalog.allCategories();
    }

    @Operation(summary = "Завести категорию")
    @PostMapping("/categories")
    public ResponseEntity<CatalogAdmin.CategoryView> createCategory(
            @Valid @RequestBody CatalogAdmin.CategoryForm form, Authentication who) {
        var created = catalog.createCategory(form, Actor.of(who));
        return ResponseEntity.created(URI.create("/api/admin/v1/categories/" + created.id()))
                .body(created);
    }

    @Operation(summary = "Правка категории")
    @PutMapping("/categories/{id}")
    public CatalogAdmin.CategoryView updateCategory(@PathVariable UUID id,
                                                    @Valid @RequestBody CatalogAdmin.CategoryForm form,
                                                    Authentication who) {
        return catalog.updateCategory(id, form, Actor.of(who));
    }

    @Operation(summary = "Удалить категорию",
            description = "Отклоняется, если в категории есть изделия: в схеме на связке "
                    + "стоит on delete restrict.")
    @DeleteMapping("/categories/{id}")
    public ResponseEntity<Void> deleteCategory(@PathVariable UUID id, Authentication who) {
        catalog.deleteCategory(id, Actor.of(who));
        return ResponseEntity.noContent().build();
    }
}
