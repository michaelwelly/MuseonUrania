package ru.vedal.portal.documents;

import org.springframework.core.io.InputStreamResource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

@RestController
@RequestMapping("/api/public/v1")
public class PublicDocumentsController {

    private final DocumentQuery documents;

    public PublicDocumentsController(DocumentQuery documents) {
        this.documents = documents;
    }

    @GetMapping("/documents")
    public ResponseEntity<List<DocumentQuery.Card>> documents() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(documents.listedDocuments());
    }

    @GetMapping("/documents/{slug}/file")
    public ResponseEntity<InputStreamResource> file(@PathVariable String slug) {
        var download = documents.download(slug);
        var stored = download.stored();

        // Файлы не кэшируем публично: состав опубликованного меняется
        // согласованием, и снятая с публикации редакция не должна жить
        // в кэшах прокси.
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .contentType(MediaType.parseMediaType(stored.contentType()))
                .contentLength(stored.size())
                .header("Content-Disposition",
                        ContentDisposition.attachment().filename(download.filename()).build().toString())
                .body(new InputStreamResource(stored.data()));
    }
}
