package ru.vedal.portal.catalog;

import java.util.List;

// Наружу отдаём отдельные записи, а не сущности: иначе схема БД становится
// публичным контрактом и её нельзя менять, не ломая сайт.
public final class PublicDto {

    public record CategoryView(String slug, String name) {}

    public record SpecView(String label, String value, boolean muted) {}

    public record Card(String slug, String name, String kind, String summary,
                       String docStatus, List<String> categories,
                       String imageSrc, String imageAlt) {}

    public record Detail(String slug, String name, String kind, String summary,
                         String detail, String docStatus, List<String> categories,
                         String imageSrc, String imageAlt,
                         List<SpecView> keyParams, List<SpecView> specs) {}

    private PublicDto() {}
}
