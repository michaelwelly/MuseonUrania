package ru.vedal.portal.documents;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.util.unit.DataSize;
import ru.vedal.portal.common.ApiExceptionHandler;
import ru.vedal.portal.common.RateLimit;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Публичные двери документов при скрытом разделе.
 *
 * <p><b>Почему такой тест понадобился.</b> Витрину документов погасили
 * выключателем {@code VEDAL_PUBLIC_DOCUMENTS_ENABLED}: страница
 * {@code /documents/} отдаёт 404, пункт меню скрыт, вкладка на карточке
 * изделия не строится, Ведалина про документы молчит. Публичное HTTP API
 * при этом осталось открытым — замер на боевой машине:
 * {@code GET /api/public/v1/documents} отдавал 200 и восемь документов
 * с рабочими ссылками, а {@code /documents/vedal-product-catalog/file} —
 * два мегабайта PDF. Выключатель гасил витрину, но не файлы.
 *
 * <p><b>Что стережёт.</b> Что закрыты обе двери, а не одна; что закрытая
 * дверь отвечает 404, а не пустым перечнем и не 403; что она не ходит
 * ни в базу, ни в журнал; что 404 приходит даже с исчерпанным лимитом
 * частоты, иначе 429 сам признался бы, что дверь существует. И обратное:
 * с включённым выключателем обе двери работают как прежде.
 *
 * <p>Базы здесь нет и Spring-контекст не поднимается: проверяется устройство
 * двери, а не хранилище. Отбор опубликованных документов сторожит
 * {@code DocumentsApiTest}, лимиты частоты — {@code DocumentsRateLimitTest}.
 */
class HiddenPublicDocumentsApiTest {

    private static final String LIST = "/api/public/v1/documents";
    private static final String FILE = "/api/public/v1/documents/vedal-product-catalog/file";

    private final DocumentQuery documents = Mockito.mock(DocumentQuery.class);

    private MockMvc portal(PublicDocumentsSection section) {
        return portal(section, new RateLimit(120, Duration.ofMinutes(10)));
    }

    private MockMvc portal(PublicDocumentsSection section, RateLimit limit) {
        var controller = new PublicDocumentsController(documents, section, limit, limit);
        return MockMvcBuilders.standaloneSetup(controller)
                // Тот же обработчик ошибок, что и в приложении: тело ответа —
                // часть двери, а не подробность реализации.
                .setControllerAdvice(new ApiExceptionHandler(DataSize.ofMegabytes(20)))
                .build();
    }

    // ————— раздел скрыт —————

    @Test
    void theListingIsGone() throws Exception {
        portal(PublicDocumentsSection.HIDDEN).perform(get(LIST))
                .andExpect(status().isNotFound());

        // Ни строки перечня наружу и ни одного запроса в базу: закрытая дверь
        // не должна ни отвечать «документов нет», ни стоить портала.
        Mockito.verifyNoInteractions(documents);
    }

    @Test
    void theFileIsGoneEvenForAPublishedDocument() throws Exception {
        publishedFile();

        portal(PublicDocumentsSection.HIDDEN).perform(get(FILE))
                .andExpect(status().isNotFound());

        // Скачивание пишет обращение в журнал — но только когда дверь есть.
        // Закрытая до документа не доходит вовсе.
        Mockito.verify(documents, Mockito.never()).download(Mockito.anyString());
    }

    // Тело ответа — такая же подсказка, как код. «Раздел скрыт» в нём означало
    // бы «файлы есть, приходите позже», а ровно этого заказчик и не хочет.
    @Test
    void theRefusalSaysNothingAboutWhatIsBehindTheDoor() throws Exception {
        var closed = portal(PublicDocumentsSection.HIDDEN);

        for (var door : List.of(LIST, FILE)) {
            closed.perform(get(door))
                    .andExpect(status().isNotFound())
                    .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                    .andExpect(jsonPath("$.title").value("Документ не найден"))
                    .andExpect(jsonPath("$.status").value(404));
        }
    }

    // 429 от закрытой двери означал бы, что за ней что-то считают: скрытый
    // раздел так отличается от несуществующего адреса одним запросом.
    @Test
    void theClosedDoorAnswersNotFoundAndNotTooManyRequests() throws Exception {
        var exhausted = portal(PublicDocumentsSection.HIDDEN, new RateLimit(0, Duration.ofMinutes(10)));

        exhausted.perform(get(LIST)).andExpect(status().isNotFound());
        exhausted.perform(get(FILE)).andExpect(status().isNotFound());
    }

    // ————— раздел открыт: всё как прежде —————

    @Test
    void theListingWorksWhenTheSectionIsOpen() throws Exception {
        Mockito.when(documents.listedDocuments()).thenReturn(List.of(
                new DocumentQuery.Card("vedal-product-catalog", "Каталог продукции",
                        "Общие материалы", "ВЕДАЛ", null, "pdf", true,
                        "/api/public/v1/documents/vedal-product-catalog/file")));

        portal(PublicDocumentsSection.OPEN).perform(get(LIST))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].slug").value("vedal-product-catalog"))
                .andExpect(jsonPath("$[0].fileUrl").value(
                        "/api/public/v1/documents/vedal-product-catalog/file"))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("max-age=300")));
    }

    @Test
    void theFileWorksWhenTheSectionIsOpen() throws Exception {
        publishedFile();

        portal(PublicDocumentsSection.OPEN).perform(get(FILE))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, containsString("attachment")))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(content().contentTypeCompatibleWith("application/pdf"));
    }

    /** Опубликованный документ с файлом — то, что дверь отдала бы при открытом разделе. */
    private void publishedFile() {
        var body = "%PDF-1.7 проба".getBytes(StandardCharsets.UTF_8);
        Mockito.when(documents.download("vedal-product-catalog")).thenReturn(
                new DocumentQuery.Download("vedal-product-catalog.pdf",
                        new FileStorage.Stored(new ByteArrayInputStream(body), body.length,
                                "application/pdf")));
    }
}
