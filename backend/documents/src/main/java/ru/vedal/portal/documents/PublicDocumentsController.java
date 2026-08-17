package ru.vedal.portal.documents;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@Tag(name = "Документы")
public class PublicDocumentsController {

    private final DocumentQuery documents;

    public PublicDocumentsController(DocumentQuery documents) {
        this.documents = documents;
    }

    @Operation(summary = "Перечень документов",
            description = "Показывается вместе со статусом доступа, в том числе строки без файла: "
                    + "такая строка на сайте ведёт на запрос. Ссылка `fileUrl` заполнена только "
                    + "у опубликованных.")
    @ApiResponse(responseCode = "200", description = "Перечень документов. Кэш пять минут.")
    @GetMapping("/documents")
    public ResponseEntity<List<DocumentQuery.Card>> documents() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(documents.listedDocuments());
    }

    @Operation(summary = "Файл документа",
            description = """
                    Отдаёт файл вложением. Скачать можно только опубликованный документ
                    с загруженным файлом.

                    Неопубликованный документ отвечает `404`, а не `403`: по коду ответа
                    не должно быть видно, что такой документ вообще есть. Каждая попытка
                    попадает в журнал.

                    Ответ не кэшируется: снятая с публикации редакция не должна остаться
                    в кэшах прокси.
                    """)
    @ApiResponse(responseCode = "200", description = "Файл вложением, `Content-Disposition: attachment`.",
            content = @Content(mediaType = "application/octet-stream",
                    schema = @Schema(type = "string", format = "binary")))
    @ApiResponse(responseCode = "404",
            description = "Документа нет, он не опубликован или файл недоступен.",
            content = @Content(mediaType = "application/problem+json",
                    schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
    @GetMapping("/documents/{slug}/file")
    public ResponseEntity<InputStreamResource> file(
            @Parameter(description = "Идентификатор документа в URL.",
                    example = "opisanie-izdeliya-vedal-r1-r2")
            @PathVariable String slug) {
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
