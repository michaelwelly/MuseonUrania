package ru.vedal.portal.content;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;

import java.time.LocalDate;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class PublicNewsApiTest extends PostgresTestBase {

    @Autowired
    MockMvc mvc;

    @Autowired
    NewsRepository news;

    @Test
    void emptyFeedIsAnEmptyList() throws Exception {
        news.deleteAll();

        // Публикаций нет и это нормальное состояние: материалы Иннопрома ещё
        // не переданы. Лента обязана отдать [], а не упасть.
        mvc.perform(get("/api/public/v1/news"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    void showsOnlyPublishedItems() throws Exception {
        news.deleteAll();
        news.save(item("news-visible", "Видимая", true));
        news.save(item("news-hidden", "Скрытая", false));

        mvc.perform(get("/api/public/v1/news"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.slug == 'news-visible')]").exists())
                .andExpect(jsonPath("$[?(@.slug == 'news-hidden')]").doesNotExist());
    }

    @Test
    void unpublishedArticleIsNotFound() throws Exception {
        news.deleteAll();
        news.save(item("news-hidden-detail", "Скрытая", false));

        mvc.perform(get("/api/public/v1/news/news-hidden-detail"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Публикация не найдена"));
    }

    private static NewsItem item(String slug, String title, boolean published) {
        var n = new NewsItem();
        n.setId(UUID.randomUUID());
        n.setSlug(slug);
        n.setTag("Выставки");
        n.setTitle(title);
        n.setExcerpt("Короткий текст для ленты.");
        n.setPublished(published);
        // Дата обязательна для опубликованного — это проверяется в схеме.
        if (published) n.setPublishedOn(LocalDate.of(2026, 7, 10));
        return n;
    }
}
