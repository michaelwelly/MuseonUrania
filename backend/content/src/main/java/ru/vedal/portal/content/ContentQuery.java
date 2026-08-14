package ru.vedal.portal.content;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.util.List;

// Единственное, что модуль показывает соседям — в том числе ассистенту,
// которому нужны только опубликованные материалы.
public interface ContentQuery {

    @Schema(name = "NewsCard", description = "Материал ленты в списке, без текста.")
    record Card(

            @Schema(description = "Идентификатор в URL.", example = "postavka-v-perinatalnyy-centr")
            String slug,

            @Schema(description = "Рубрика.",
                    allowableValues = {"Продукция", "Производство", "Выставки", "Сервис", "Документы"},
                    example = "Производство")
            String tag,

            @Schema(description = "Заголовок.")
            String title,

            @Schema(description = "Анонс для списка.")
            String excerpt,

            @Schema(description = "Дата публикации. Сайт показывает её словами, разбор формата — "
                    + "забота интерфейса.", format = "date", example = "2026-08-13")
            LocalDate publishedOn,

            @Schema(description = "Путь к иллюстрации на сайте.", nullable = true)
            String imageSrc,

            @Schema(description = "Подпись к иллюстрации.", nullable = true)
            String imageAlt) {}

    @Schema(name = "NewsArticle", description = "Материал ленты целиком.")
    record Article(

            @Schema(description = "Идентификатор в URL.", example = "postavka-v-perinatalnyy-centr")
            String slug,

            @Schema(description = "Рубрика.", example = "Производство")
            String tag,

            @Schema(description = "Заголовок.")
            String title,

            @Schema(description = "Анонс для списка.")
            String excerpt,

            @Schema(description = "Текст материала. `null`, если заполнен только анонс.",
                    nullable = true)
            String body,

            @Schema(description = "Дата публикации.", format = "date", example = "2026-08-13")
            LocalDate publishedOn,

            @Schema(description = "Путь к иллюстрации на сайте.", nullable = true)
            String imageSrc,

            @Schema(description = "Подпись к иллюстрации.", nullable = true)
            String imageAlt) {}

    List<Card> publishedNews();

    Article publishedArticle(String slug);
}
