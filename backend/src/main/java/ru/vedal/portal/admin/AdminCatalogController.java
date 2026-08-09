package ru.vedal.portal.admin;

import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import ru.vedal.portal.catalog.Product;
import ru.vedal.portal.catalog.ProductRepository;
import ru.vedal.portal.common.NotFoundException;

import java.time.Instant;
import java.util.UUID;

@Controller
@RequestMapping("/admin/products")
public class AdminCatalogController {

    private final ProductRepository products;

    public AdminCatalogController(ProductRepository products) {
        this.products = products;
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
                       @RequestParam String docStatus) {
        var product = find(id);
        product.setName(name);
        product.setKind(kind);
        product.setSummary(summary);
        product.setDetail(detail.isBlank() ? null : detail);
        product.setDocStatus(docStatus);
        product.setUpdatedAt(Instant.now());
        products.save(product);
        return "redirect:/admin/products";
    }

    // Публикация — отдельное действие, а не поле формы: снятие с публикации
    // убирает изделие с сайта, и это не должно случаться заодно с правкой текста.
    @PostMapping("/{id}/publish")
    @Transactional
    public String togglePublish(@PathVariable UUID id) {
        var product = find(id);
        product.setPublished(!product.isPublished());
        product.setUpdatedAt(Instant.now());
        products.save(product);
        return "redirect:/admin/products";
    }

    private Product find(UUID id) {
        return products.findById(id).orElseThrow(() -> new NotFoundException("Изделие не найдено"));
    }
}
