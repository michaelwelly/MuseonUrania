package ru.vedal.portal.documents;

import java.util.List;

// Единственное, что модуль показывает соседям — включая ассистента, которому
// нужны только опубликованные документы.
public interface DocumentQuery {

    record Card(String slug, String title, String group, String subject, String productSlug,
                String access, boolean published, String fileUrl) {}

    record Download(String filename, FileStorage.Stored stored) {}

    List<Card> listedDocuments();

    Download download(String slug);
}
