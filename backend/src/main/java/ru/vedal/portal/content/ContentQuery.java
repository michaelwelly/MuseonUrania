package ru.vedal.portal.content;

import java.time.LocalDate;
import java.util.List;

// Единственное, что модуль показывает соседям — в том числе ассистенту,
// которому нужны только опубликованные материалы.
public interface ContentQuery {

    record Card(String slug, String tag, String title, String excerpt,
                LocalDate publishedOn, String imageSrc, String imageAlt) {}

    record Article(String slug, String tag, String title, String excerpt, String body,
                   LocalDate publishedOn, String imageSrc, String imageAlt) {}

    List<Card> publishedNews();

    Article publishedArticle(String slug);
}
