package ru.vedal.portal.admin;

import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import ru.vedal.portal.audit.AuditLog;
import ru.vedal.portal.catalog.Product;
import ru.vedal.portal.catalog.ProductRepository;
import ru.vedal.portal.common.NotFoundException;

import java.security.Principal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Controller
@RequestMapping("/admin/products")
public class AdminCatalogController {

    private final ProductRepository products;
    private final AuditLog audit;

    public AdminCatalogController(ProductRepository products, AuditLog audit) {
        this.products = products;
        this.audit = audit;
    }

    @GetMapping
    public String list(Model model) {
        model.addAttribute("products", products.findAllByOrderBySortOrderAscNameAsc());
        return "admin/products";
    }

    @GetMapping("/{id}")
    public String form(@PathVariable UUID id, Model model) {
        model.addAttribute("product", find(id));
        return "admin/product-form";
    }

    @PostMapping("/{id}")
    @Transactional
    public String save(@PathVariable UUID id,
                       @RequestParam String name,
                       @RequestParam String kind,
                       @RequestParam String summary,
                       @RequestParam String detail,
                       @RequestParam String docStatus,
                       Principal who) {
        var product = find(id);
        product.setName(name);
        product.setKind(kind);
        product.setSummary(summary);
        product.setDetail(detail.isBlank() ? null : detail);
        product.setDocStatus(docStatus);
        product.setUpdatedAt(Instant.now());
        products.save(product);
        audit.record(actor(who), "product.edit", "product", product.getSlug(),
                Map.of("docStatus", docStatus));
        return "redirect:/admin/products";
    }

    // Публикация — отдельное действие, а не поле формы: снятие с публикации
    // убирает изделие с сайта, и это не должно случаться заодно с правкой текста.
    @PostMapping("/{id}/publish")
    @Transactional
    public String togglePublish(@PathVariable UUID id, Principal who) {
        var product = find(id);
        product.setPublished(!product.isPublished());
        product.setUpdatedAt(Instant.now());
        products.save(product);
        // Пишем в той же транзакции, что и само изменение: видимость изделия
        // на сайте меняется здесь, и запись об этом не должна разойтись с фактом.
        audit.record(actor(who), product.isPublished() ? "product.publish" : "product.unpublish",
                "product", product.getSlug(), Map.of());
        return "redirect:/admin/products";
    }

    private static String actor(Principal who) {
        return who == null ? "anonymous" : who.getName();
    }

    private Product find(UUID id) {
        return products.findById(id).orElseThrow(() -> new NotFoundException("Изделие не найдено"));
    }
}
