package ru.vedal.portal.content;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

// Вторая дверь модуля — для редактора. ContentQuery отдаёт только
// опубликованное, здесь видно всё, включая черновики.
public interface ContentAdmin {

    // Рубрики закрыты проверкой в схеме (news_item.tag). Список продублирован
    // здесь, чтобы админка нарисовала выбор, а не свободное поле, в котором
    // опечатка заканчивается отказом базы.
    List<String> TAGS = List.of("Продукция", "Производство", "Выставки", "Сервис", "Документы");

    @Schema(name = "AdminNewsRow", description = "Строка списка материалов, включая черновики.")
    record NewsRow(UUID id, String slug, String tag, String title, boolean published,
                   LocalDate publishedOn, Instant updatedAt) {}

    @Schema(name = "AdminNews", description = "Материал целиком, как его правит редактор.")
    record NewsView(UUID id,
                    @Schema(description = "Версия материала. Её надо вернуть в форме правки.")
                    long version,
                    String slug, String tag, String title, String excerpt, String body,
                    boolean published, LocalDate publishedOn, String imageSrc, String imageAlt,
                    Instant createdAt, Instant updatedAt) {}

    @Schema(name = "AdminNewsForm", description = """
            Правка материала. `published` здесь нет: публикация — отдельное
            действие. `publishedOn` — дата в ленте, она задаётся заранее
            и к видимости отношения не имеет.
            """)
    record NewsForm(

            @Schema(description = "Версия материала, прочитанная перед правкой. Обязательна "
                    + "при обновлении, при создании игнорируется.", nullable = true)
            Long version,

            @Schema(description = "Идентификатор в URL.", example = "postavka-v-perinatalnyy-centr")
            @NotBlank
            @Pattern(regexp = "^[a-z0-9]+(?:-[a-z0-9]+)*$",
                    message = "Только латиница в нижнем регистре, цифры и дефис")
            String slug,

            @Schema(description = "Рубрика из закрытого списка.",
                    allowableValues = {"Продукция", "Производство", "Выставки", "Сервис", "Документы"})
            @NotBlank String tag,

            @NotBlank @Size(max = 300) String title,

            @Schema(description = "Анонс для ленты.")
            @NotBlank @Size(max = 1000) String excerpt,

            @Schema(description = "Текст материала.", nullable = true)
            @Size(max = 100000) String body,

            @Schema(description = "Дата в ленте. Без неё материал нельзя опубликовать — "
                    + "это ограничение схемы, а не пожелание.",
                    format = "date", example = "2026-08-13", nullable = true)
            LocalDate publishedOn,

            @Size(max = 500) String imageSrc,
            @Size(max = 500) String imageAlt) {}

    List<NewsRow> allNews();

    NewsView news(UUID id);

    NewsView createNews(NewsForm form, String actor);

    NewsView updateNews(UUID id, NewsForm form, String actor);

    NewsView setNewsPublished(UUID id, boolean published, String actor);

    void deleteNews(UUID id, String actor);
}
