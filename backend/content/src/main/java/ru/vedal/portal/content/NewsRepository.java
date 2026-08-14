package ru.vedal.portal.content;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NewsRepository extends JpaRepository<NewsItem, UUID> {

    List<NewsItem> findByPublishedTrueOrderByPublishedOnDesc();

    Optional<NewsItem> findBySlugAndPublishedTrue(String slug);

    List<NewsItem> findAllByOrderByCreatedAtDesc();

    boolean existsBySlug(String slug);
}
