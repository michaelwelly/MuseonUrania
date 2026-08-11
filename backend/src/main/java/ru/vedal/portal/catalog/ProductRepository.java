package ru.vedal.portal.catalog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProductRepository extends JpaRepository<Product, UUID> {

    List<Product> findByPublishedTrueOrderBySortOrderAscNameAsc();

    Optional<Product> findBySlugAndPublishedTrue(String slug);

    List<Product> findAllByOrderBySortOrderAscNameAsc();
}
