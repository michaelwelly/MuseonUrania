package ru.vedal.portal.documents;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.vedal.portal.common.RateLimit;
import ru.vedal.portal.common.TooManyRequestsException;

import java.time.Duration;
import java.util.List;

@RestController
@RequestMapping("/api/public/v1")
@Tag(name = "Документы")
public class PublicDocumentsController {

    private final DocumentQuery documents;
    private final RateLimit rateLimit;

    public PublicDocumentsController(DocumentQuery documents,
                                     @Qualifier("documentsRateLimit") RateLimit rateLimit) {
        this.documents = documents;
        this.rateLimit = rateLimit;
    }

    @Operation(summary = "Перечень документов",
            description = """
                    Показывается вместе со статусом доступа, в том числе строки без файла:
                    такая строка на сайте ведёт на запрос. Ссылка `fileUrl` заполнена только
                    у опубликованных.

                    Лимит частоты общий со скачиванием файла — 30 обращений за 10 минут
                    с адреса.
                    """)
    @ApiResponse(responseCode = "200", description = "Перечень документов. Кэш пять минут.")
    @ApiResponse(responseCode = "429", description = "Превышен лимит частоты.",
            content = @Content(mediaType = "application/problem+json",
                    schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
    @GetMapping("/documents")
    public ResponseEntity<List<DocumentQuery.Card>> documents(HttpServletRequest http) {
        if (!rateLimit.allow(http.getRemoteAddr())) {
            throw new TooManyRequestsException("Слишком много обращений подряд. Попробуйте позже.");
        }
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

                    Лимит частоты общий с перечнем — 30 обращений за 10 минут с адреса.
                    Скачивание тянет файл из хранилища и держит поток обслуживания на всё
                    время передачи — самая дорогая публичная дверь портала, и без предела
                    самая дешёвая для того, кто хочет его положить.
                    """)
    @ApiResponse(responseCode = "200", description = "Файл вложением, `Content-Disposition: attachment`.",
            content = @Content(mediaType = "application/octet-stream",
                    schema = @Schema(type = "string", format = "binary")))
    @ApiResponse(responseCode = "404",
            description = "Документа нет, он не опубликован или файл недоступен.",
            content = @Content(mediaType = "application/problem+json",
                    schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
    @ApiResponse(responseCode = "429", description = "Превышен лимит частоты.",
            content = @Content(mediaType = "application/problem+json",
                    schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
    @GetMapping("/documents/{slug}/file")
    public ResponseEntity<InputStreamResource> file(
            @Parameter(description = "Идентификатор документа в URL.",
                    example = "vedal-r1-product-sheet")
            @PathVariable String slug,
            HttpServletRequest http) {
        if (!rateLimit.allow(http.getRemoteAddr())) {
            throw new TooManyRequestsException("Слишком много обращений подряд. Попробуйте позже.");
        }
        var download = documents.download(slug);
        var stored = download.stored();

        // Публичная кнопка обещает именно файл. Даже PDF отдаём вложением:
        // так поведение одинаковое на странице документов, в карточке изделия
        // и в разных браузерах, где inline-просмотр часто выглядит как
        // «скачивание не сработало».
        var disposition = ContentDisposition.attachment().filename(download.filename()).build();

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
