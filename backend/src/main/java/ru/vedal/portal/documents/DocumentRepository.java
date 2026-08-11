package ru.vedal.portal.documents;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentRepository extends JpaRepository<Document, UUID> {

    List<Document> findByListedTrueOrderByDocGroupAscTitleAsc();

    Optional<Document> findBySlug(String slug);

    List<Document> findAllByOrderByDocGroupAscTitleAsc();
}
