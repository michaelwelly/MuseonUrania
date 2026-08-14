package ru.vedal.portal.catalog;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

// Наружу отдаём отдельные записи, а не сущности: иначе схема БД становится
// публичным контрактом и её нельзя менять, не ломая сайт.
public final class PublicDto {

    @Schema(name = "Category", description = "Категория каталога.")
    public record CategoryView(

            @Schema(description = "Идентификатор в URL.", example = "неонатология")
            String slug,

            @Schema(description = "Название для показа.", example = "Неонатология")
            String name) {}

    @Schema(name = "Spec", description = "Строка характеристики: подпись и значение.")
    public record SpecView(

            @Schema(description = "Подпись строки.", example = "Габариты R1")
            String label,

            @Schema(description = "Значение как его показывает сайт, вместе с единицами.",
                    example = "1185 × 740 × 1840 мм")
            String value,

            @Schema(description = "Значение приглушается в вёрстке: ориентировочное или ожидающее "
                    + "подтверждения. Отдаётся всегда, в том числе false.")
            boolean muted) {}

    @Schema(name = "ProductCard",
            description = "Изделие в списке. Полный состав характеристик отдаёт карточка изделия.")
    public record Card(

            @Schema(description = "Идентификатор в URL.", example = "vedal-r1-r2")
            String slug,

            @Schema(description = "Название изделия.", example = "VEDAL R1, R2")
            String name,

            @Schema(description = "Тип изделия одной строкой.",
                    example = "Системы реанимационные для новорождённых")
            String kind,

            @Schema(description = "Краткое описание для списка.")
            String summary,

            @Schema(description = "Состояние регистрационных документов. `confirmed` — сведения "
                    + "подтверждены документами, `pending` — ещё уточняются. Это не флаг "
                    + "публикации: неопубликованного изделия в ответе нет вообще.",
                    allowableValues = {"confirmed", "pending"}, example = "confirmed")
            String docStatus,

            @Schema(description = "Названия категорий, к которым отнесено изделие.",
                    example = "[\"Реанимация\", \"Неонатология\"]")
            List<String> categories,

            @Schema(description = "Путь к фотографии на сайте. `null`, если фотографии нет.",
                    example = "/photos/products/vedal-r1-r2.jpg", nullable = true)
            String imageSrc,

            @Schema(description = "Подпись к фотографии. `null` вместе с `imageSrc`.",
                    example = "Открытая реанимационная система VEDAL", nullable = true)
            String imageAlt) {}

    @Schema(name = "ProductDetail", description = "Карточка изделия целиком.")
    public record Detail(

            @Schema(description = "Идентификатор в URL.", example = "vedal-r1-r2")
            String slug,

            @Schema(description = "Название изделия.", example = "VEDAL R1, R2")
            String name,

            @Schema(description = "Тип изделия одной строкой.",
                    example = "Системы реанимационные для новорождённых")
            String kind,

            @Schema(description = "Краткое описание для списка.")
            String summary,

            @Schema(description = "Развёрнутое описание. `null`, если его ещё не написали.",
                    nullable = true)
            String detail,

            @Schema(description = "Состояние регистрационных документов.",
                    allowableValues = {"confirmed", "pending"}, example = "confirmed")
            String docStatus,

            @Schema(description = "Названия категорий, к которым отнесено изделие.")
            List<String> categories,

            @Schema(description = "Путь к фотографии на сайте.", nullable = true)
            String imageSrc,

            @Schema(description = "Подпись к фотографии.", nullable = true)
            String imageAlt,

            @Schema(description = "Ключевые параметры — короткий блок наверху карточки.")
            List<SpecView> keyParams,

            @Schema(description = "Полная таблица характеристик.")
            List<SpecView> specs) {}

    private PublicDto() {}
}
