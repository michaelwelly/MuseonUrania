package ru.vedal.portal.documents;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentRepository extends JpaRepository<Document, UUID> {

    List<Document> findByListedTrueOrderByDocGroupAscTitleAsc();

    /**
     * Публичный перечень. Уровень секретности в условии обязателен: отбор
     * по одному listed отдавал наружу название и предмет закрытого документа,
     * если его пометили как «в перечне». Файл при этом оставался недоступен,
     * но и одного названия достаточно.
     */
    List<Document> findByListedTrueAndSensitivityOrderByDocGroupAscTitleAsc(String sensitivity);

    /**
     * Материалы закрытого контура: public и internal. Confidential в список
     * не передаём — он не индексируется ассистентом ни при каком входе.
     */
    List<Document> findBySensitivityInOrderByDocGroupAscTitleAsc(List<String> sensitivities);

    Optional<Document> findBySlug(String slug);

    List<Document> findAllByOrderByDocGroupAscTitleAsc();
}
