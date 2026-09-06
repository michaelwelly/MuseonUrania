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

        // PDF открываем в браузере, остальное отдаём файлом.
        //
        // Для посетителя «открыть» и «скачать» — разные вещи: за датащитом
        // и сертификатом приходят посмотреть, а не пополнить папку
        // «Загрузки». Раньше здесь стоял attachment на всё подряд, и любой
        // документ уезжал на диск, даже если человеку хватило бы взгляда.
        //
        // Но inline на ЧТО УГОДНО — это дыра, а не удобство. Тип файла при
        // загрузке не ограничен ничем (DocumentEditor.uploadFile проверяет
        // только размер), а StorageLimits.contentType умеет отдавать
        // image/svg+xml. SVG — это документ со скриптами внутри, и
        // показанный inline он выполняет их в НАШЕМ источнике: с нашими
        // куками и нашим доменом. Поэтому inline ровно для application/pdf,
        // всё прочее по-прежнему attachment.
        var inline = MediaType.APPLICATION_PDF_VALUE.equals(stored.contentType());
        var disposition = inline
                ? ContentDisposition.inline().filename(download.filename()).build()
                : ContentDisposition.attachment().filename(download.filename()).build();

        // Файлы не кэшируем публично: состав опубликованного меняется
        // согласованием, и снятая с публикации редакция не должна жить
        // в кэшах прокси.
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .contentType(MediaType.parseMediaType(stored.contentType()))
                .contentLength(stored.size())
                // Без nosniff браузер вправе перепроверить тип по содержимому
                // и открыть как страницу то, что мы назвали документом, —
                // то есть обойти разбор выше по расширению.
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Disposition", disposition.toString())
                .body(new InputStreamResource(stored.data()));
    }
}
