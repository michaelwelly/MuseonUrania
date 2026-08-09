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
import ru.vedal.portal.common.NotFoundException;
import ru.vedal.portal.content.NewsItem;
import ru.vedal.portal.content.NewsRepository;

import java.security.Principal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

@Controller
@RequestMapping("/admin/news")
public class AdminNewsController {

    // Слаг уходит в публичный URL, поэтому только латиница, цифры и дефис.
    // Кириллица в пути превращается в процент-кодирование и ломает ссылки
    // в письмах и мессенджерах.
    private static final String SLUG = "[a-z0-9][a-z0-9-]*";

    static final String[] TAGS = {"Продукция", "Производство", "Выставки", "Сервис", "Документы"};

    private final NewsRepository news;
    private final AuditLog audit;

    public AdminNewsController(NewsRepository news, AuditLog audit) {
        this.news = news;
        this.audit = audit;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public String list(Model model) {
        model.addAttribute("news", news.findAllByOrderByCreatedAtDesc());
        return "admin/news";
    }

    @GetMapping("/new")
    public String blank(Model model) {
        model.addAttribute("item", new NewsItem());
        model.addAttribute("tags", TAGS);
        model.addAttribute("creating", true);
        return "admin/news-form";
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public String form(@PathVariable UUID id, Model model) {
        model.addAttribute("item", find(id));
        model.addAttribute("tags", TAGS);
        model.addAttribute("creating", false);
        return "admin/news-form";
    }

    @PostMapping
    @Transactional
    public String create(@RequestParam String slug,
                         @RequestParam String tag,
                         @RequestParam String title,
                         @RequestParam String excerpt,
                         @RequestParam String body,
                         @RequestParam(required = false) String publishedOn,
                         Principal who) {
        if (!slug.matches(SLUG)) {
            throw new IllegalArgumentException("Слаг: латиница, цифры и дефис");
        }
        if (news.existsBySlug(slug)) {
            throw new IllegalArgumentException("Публикация с таким слагом уже есть");
        }

        var item = new NewsItem();
        item.setId(UUID.randomUUID());
        item.setSlug(slug);
        apply(item, tag, title, excerpt, body, publishedOn);
        news.save(item);

        audit.record(actor(who), "news.create", "news", slug, Map.of("tag", tag));
        return "redirect:/admin/news";
    }

    @PostMapping("/{id}")
    @Transactional
    public String save(@PathVariable UUID id,
                       @RequestParam String tag,
                       @RequestParam String title,
                       @RequestParam String excerpt,
                       @RequestParam String body,
                       @RequestParam(required = false) String publishedOn,
                       Principal who) {
        var item = find(id);
        apply(item, tag, title, excerpt, body, publishedOn);
        news.save(item);

        audit.record(actor(who), "news.edit", "news", item.getSlug(), Map.of("tag", tag));
        return "redirect:/admin/news";
    }

    @PostMapping("/{id}/publish")
    @Transactional
    public String togglePublish(@PathVariable UUID id, Principal who) {
        var item = find(id);
        item.setPublished(!item.isPublished());
        // Публикация без даты запрещена в схеме, а «опубликовать» для редактора
        // означает «показать сегодня» — подставляем дату, а не отказываем.
        if (item.isPublished() && item.getPublishedOn() == null) {
            item.setPublishedOn(LocalDate.now());
        }
        item.setUpdatedAt(Instant.now());
        news.save(item);

        audit.record(actor(who), item.isPublished() ? "news.publish" : "news.unpublish",
                "news", item.getSlug(), Map.of());
        return "redirect:/admin/news";
    }

    private void apply(NewsItem item, String tag, String title, String excerpt, String body,
                       String publishedOn) {
        item.setTag(tag);
        item.setTitle(title);
        item.setExcerpt(excerpt);
        item.setBody(body.isBlank() ? null : body);
        item.setPublishedOn(publishedOn == null || publishedOn.isBlank() ? null : LocalDate.parse(publishedOn));
        item.setUpdatedAt(Instant.now());
    }

    private NewsItem find(UUID id) {
        return news.findById(id).orElseThrow(() -> new NotFoundException("Публикация не найдена"));
    }

    private static String actor(Principal who) {
        return who == null ? "anonymous" : who.getName();
    }
}
