package ru.vedal.portal.content;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.audit.AuditLog;
import ru.vedal.portal.common.ConflictException;
import ru.vedal.portal.common.NotFoundException;
import ru.vedal.portal.common.Versions;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ContentEditor implements ContentAdmin {

    private final NewsRepository news;
    private final AuditLog audit;

    public ContentEditor(NewsRepository news, AuditLog audit) {
        this.news = news;
        this.audit = audit;
    }

    @Override
    @Transactional(readOnly = true)
    public List<NewsRow> allNews() {
        return news.findAllByOrderByCreatedAtDesc().stream()
                .map(n -> new NewsRow(n.getId(), n.getSlug(), n.getTag(), n.getTitle(),
                        n.isPublished(), n.getPublishedOn(), n.getUpdatedAt()))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public NewsView news(UUID id) {
        return view(find(id));
    }

    @Override
    @Transactional
    public NewsView createNews(NewsForm form, String actor) {
        checkTag(form.tag());
        if (news.existsBySlug(form.slug())) {
            throw new ConflictException("Материал с таким slug уже есть: " + form.slug());
        }

        var item = new NewsItem();
        item.setId(UUID.randomUUID());
        item.setCreatedAt(Instant.now());
        item.setPublished(false);
        apply(item, form);
        news.save(item);

        audit.record(actor, "news.create", "news", item.getSlug(), Map.of("tag", item.getTag()));
        return view(item);
    }

    @Override
    @Transactional
    public NewsView updateNews(UUID id, NewsForm form, String actor) {
        checkTag(form.tag());
        var item = find(id);
        Versions.check(form.version(), item.getVersion(), "Материал");

        // Та же причина, что и у изделия: адрес опубликованного материала
        // разослан и проиндексирован, переименование его обрывает.
        if (item.isPublished() && !item.getSlug().equals(form.slug())) {
            throw new ConflictException(
                    "Опубликованный материал нельзя переименовать: адрес /news/"
                            + item.getSlug() + " перестанет открываться.");
        }
        if (!item.getSlug().equals(form.slug()) && news.existsBySlug(form.slug())) {
            throw new ConflictException("Материал с таким slug уже есть: " + form.slug());
        }

        apply(item, form);
        news.saveAndFlush(item);

        audit.record(actor, "news.edit", "news", item.getSlug(), Map.of());
        return view(item);
    }

    @Override
    @Transactional
    public NewsView setNewsPublished(UUID id, boolean published, String actor) {
        var item = find(id);
        if (item.isPublished() == published) return view(item);

        // Ограничение news_published_needs_date не даст сохранить материал
        // без даты. Проверяем заранее, чтобы редактор увидел, чего не хватает,
        // а не отказ базы с именем ограничения.
        if (published && item.getPublishedOn() == null) {
            throw new ConflictException(
                    "Без даты публиковать нельзя: лента сортируется по ней "
                            + "и показывает её в карточке.");
        }

        item.setPublished(published);
        item.setUpdatedAt(Instant.now());
        news.save(item);

        audit.record(actor, published ? "news.publish" : "news.unpublish",
                "news", item.getSlug(), Map.of());
        return view(item);
    }

    @Override
    @Transactional
    public void deleteNews(UUID id, String actor) {
        var item = find(id);

        // Опубликованное удаляется в два шага. Удаление сразу означало бы,
        // что живая ссылка из рассылки перестаёт открываться одним нажатием
        // и без следа в ленте.
        if (item.isPublished()) {
            throw new ConflictException("Сначала снимите материал с публикации.");
        }

        news.delete(item);
        audit.record(actor, "news.delete", "news", item.getSlug(), Map.of("title", item.getTitle()));
    }

    private static void checkTag(String tag) {
        if (!TAGS.contains(tag)) {
            throw new ConflictException("Неизвестная рубрика: " + tag
                    + ". Допустимые: " + String.join(", ", TAGS));
        }
    }

    private static void apply(NewsItem item, NewsForm form) {
        item.setSlug(form.slug());
        item.setTag(form.tag());
        item.setTitle(form.title());
        item.setExcerpt(form.excerpt());
        item.setBody(form.body() == null || form.body().isBlank() ? null : form.body());
        item.setPublishedOn(form.publishedOn());
        item.setImageSrc(form.imageSrc() == null || form.imageSrc().isBlank() ? null : form.imageSrc());
        item.setImageAlt(form.imageAlt() == null || form.imageAlt().isBlank() ? null : form.imageAlt());
        item.setUpdatedAt(Instant.now());
    }

    private static NewsView view(NewsItem n) {
        return new NewsView(n.getId(), n.getVersion(), n.getSlug(), n.getTag(), n.getTitle(), n.getExcerpt(),
                n.getBody(), n.isPublished(), n.getPublishedOn(), n.getImageSrc(), n.getImageAlt(),
                n.getCreatedAt(), n.getUpdatedAt());
    }

    private NewsItem find(UUID id) {
        return news.findById(id).orElseThrow(() -> new NotFoundException("Материал не найден"));
    }
}
