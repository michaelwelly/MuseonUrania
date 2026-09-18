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
import ru.vedal.portal.common.NotFoundException;
import ru.vedal.portal.common.RateLimit;
import ru.vedal.portal.common.TooManyRequestsException;

import java.time.Duration;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/public/v1")
@Tag(name = "Документы")
public class PublicDocumentsController {

    /**
     * Один и тот же текст на «документа нет», «документ закрыт» и «раздела
     * сейчас нет». Снаружи эти три случая должны быть неразличимы: разный
     * текст в теле ответа — такая же подсказка, как разный код, только
     * читаемая глазами.
     */
    private static final String NOT_FOUND = "Документ не найден";

    // Общая витрина остаётся закрытой по решению заказчика. Новую карточку
    // A-2000 заказчик разрешил разместить 18 сентября 2026 отдельно, поэтому
    // наружу выходит только этот точный ключ, без перечня и соседних файлов.
    private static final Set<String> PRODUCT_FILES_WHILE_SECTION_HIDDEN = Set.of(
            "vedal-a-2000-product-sheet");

    private final DocumentQuery documents;
    private final PublicDocumentsSection section;
    private final RateLimit listRateLimit;
    private final RateLimit downloadRateLimit;

    public PublicDocumentsController(DocumentQuery documents,
                                     PublicDocumentsSection section,
                                     @Qualifier("documentsListRateLimit") RateLimit listRateLimit,
                                     @Qualifier("documentsDownloadRateLimit") RateLimit downloadRateLimit) {
        this.documents = documents;
        this.section = section;
        this.listRateLimit = listRateLimit;
        this.downloadRateLimit = downloadRateLimit;
    }

    /**
     * Закрытый раздел отвечает так же, как сайт на скрытую страницу: 404.
     *
     * <p>Не пустой перечень и не 403. Пустой перечень — это «документов нет»,
     * то есть неправда, которую сайт и интегратор примут за факт; 403 — это
     * «они есть, но вам нельзя», то есть подсказка искать дальше. 404 говорит
     * ровно то, что нужно сказать: такой двери здесь нет.
     *
     * <p>Проверяется раньше лимита частоты намеренно. Закрытая дверь не должна
     * отвечать 429: ответ «слишком часто» сам по себе означает, что за дверью
     * что-то считают, — и заодно даёт отличить скрытый раздел от ненастоящего
     * адреса. Заодно закрытая дверь не ходит ни в базу, ни в журнал.
     */
    private void requireOpenSection() {
        if (section.hidden()) {
            throw new NotFoundException(NOT_FOUND);
        }
    }

    private void requireOpenFile(String slug) {
        if (section.hidden() && !PRODUCT_FILES_WHILE_SECTION_HIDDEN.contains(slug)) {
            throw new NotFoundException(NOT_FOUND);
        }
    }

    @Operation(summary = "Перечень документов",
            description = """
                    Показывается вместе со статусом доступа, в том числе строки без файла:
                    такая строка на сайте ведёт на запрос. Ссылка `fileUrl` заполнена только
                    у опубликованных.

                    Просмотр перечня и скачивание имеют независимые лимиты — по 120
                    обращений за 10 минут с адреса.

                    Пока публичный раздел документов скрыт настройкой портала
                    (`VEDAL_PUBLIC_DOCUMENTS_ENABLED`), дверь отвечает `404` —
                    как и сама страница раздела на сайте.
                    """)
    @ApiResponse(responseCode = "200", description = "Перечень документов. Кэш пять минут.")
    @ApiResponse(responseCode = "404", description = "Публичный раздел документов скрыт.",
            content = @Content(mediaType = "application/problem+json",
                    schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
    @ApiResponse(responseCode = "429", description = "Превышен лимит частоты.",
            content = @Content(mediaType = "application/problem+json",
                    schema = @Schema(ref = "#/components/schemas/ProblemDetail")))
    @GetMapping("/documents")
    public ResponseEntity<List<DocumentQuery.Card>> documents(HttpServletRequest http) {
        requireOpenSection();
        if (!listRateLimit.allow(http.getRemoteAddr())) {
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

                    Пока публичный раздел документов скрыт настройкой портала
                    (`VEDAL_PUBLIC_DOCUMENTS_ENABLED`), остальные опубликованные
                    документы отвечают `404`. Карточка A-2000 доступна отдельно
                    по прямому решению заказчика от 18 сентября 2026.

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
            description = "Документа нет, он не опубликован, файл недоступен "
                    + "или публичный раздел документов скрыт.",
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
        requireOpenFile(slug);
        if (!downloadRateLimit.allow(http.getRemoteAddr())) {
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
