package ru.vedal.portal.content;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.common.NotFoundException;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class ContentService implements ContentQuery {

    private final NewsRepository news;

    public ContentService(NewsRepository news) {
        this.news = news;
    }

    @Override
    public List<Card> publishedNews() {
        return news.findByPublishedTrueOrderByPublishedOnDesc().stream()
                .map(n -> new Card(n.getSlug(), n.getTag(), n.getTitle(), n.getExcerpt(),
                        n.getPublishedOn(), n.getImageSrc(), n.getImageAlt()))
                .toList();
    }

    @Override
    public Article publishedArticle(String slug) {
        // Неопубликованное для внешнего мира не существует: 404, а не 403.
        var n = news.findBySlugAndPublishedTrue(slug)
                .orElseThrow(() -> new NotFoundException("Публикация не найдена"));
        return new Article(n.getSlug(), n.getTag(), n.getTitle(), n.getExcerpt(), n.getBody(),
                n.getPublishedOn(), n.getImageSrc(), n.getImageAlt());
    }
}
