package ru.vedal.portal.documents;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;
import ru.vedal.portal.audit.AuditEntryRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class DocumentsApiTest extends PostgresTestBase {

    @Autowired
    MockMvc mvc;

    @Autowired
    DocumentRepository documents;

    @Autowired
    AuditEntryRepository audit;

    // Перечень показывается вместе со статусом доступа, даже когда файла нет:
    // страница «Документы» так и устроена. Но ссылки на файл быть не должно.
    @Test
    void listedDocumentsHaveNoFileLinkUntilPublished() throws Exception {
        mvc.perform(get("/api/public/v1/documents"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].slug").exists())
                .andExpect(jsonPath("$[?(@.published == true)]").doesNotExist())
                .andExpect(jsonPath("$[?(@.fileUrl != null)]").doesNotExist());
    }

    @Test
    void closedFileIsNotFoundAndTheAttemptIsJournaled() throws Exception {
        mvc.perform(get("/api/public/v1/documents/katalog-produkcii-2026/file"))
                .andExpect(status().isNotFound());

        // Запись делается в отдельной транзакции: запрос заканчивается
        // исключением, и в общей транзакции она откатилась бы вместе с ним.
        assertThat(audit.findBySubjectAndSubjectIdOrderByAtDesc("document", "katalog-produkcii-2026"))
                .extracting(e -> e.getAction())
                .contains("document.access.denied");
    }

    @Test
    void unknownDocumentIsAlsoJournaled() throws Exception {
        mvc.perform(get("/api/public/v1/documents/no-such-document/file"))
                .andExpect(status().isNotFound());

        assertThat(audit.findBySubjectAndSubjectIdOrderByAtDesc("document", "no-such-document"))
                .isNotEmpty();
    }

    // Сервисные инструкции, конструкторская и производственная документация
    // публично не размещаются. Правило закрыто в схеме, а не в коде админки.
    @Test
    void internalDocumentCannotBecomePublic() {
        var document = documents.findBySlug("opisanie-izdeliya-vedal-r1-r2").orElseThrow();
        document.setSensitivity("internal");
        document.setStorageKey("probe.pdf");
        // listed выключен намеренно: с ним первым сработал бы
        // document_listed_only_public, и тест проверял бы уже не то правило.
        // Здесь проверяется именно запрет публикации непубличного документа.
        document.setListed(false);
        document.setPublished(true);

        assertThatThrownBy(() -> documents.saveAndFlush(document))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("document_public_only");
    }

    @Test
    void publishingWithoutFileIsRejectedBySchema() {
        var document = documents.findBySlug("katalog-produkcii-2026").orElseThrow();
        document.setStorageKey(null);
        document.setListed(true);
        document.setPublished(true);

        assertThatThrownBy(() -> documents.saveAndFlush(document))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("document_published_has_file");
    }

    // §12.4 плана: confidential-документы не индексируются и не показываются.
    //
    // Файл у них и так недостижим — `document_public_only` не даёт поставить
    // published непубличному документу. Но перечень отбирался только по listed,
    // а он с уровнем секретности никак не связан. Достаточно было пометить
    // закрытый документ как «в перечне», и наружу уезжали название, предмет
    // и привязка к изделию — без файла, но этого хватает: «Отчёт об испытаниях
    // VEDAL R2» в открытом списке говорит о продукте больше, чем хотелось бы.
    //
    // Тот же перечень читает ассистент, поэтому утечка попадала бы и в ответы.
    @Test
    void confidentialDocumentNeverReachesThePublicListing() {
        var document = documents.findBySlug("katalog-produkcii-2026").orElseThrow();
        document.setSensitivity("confidential");
        document.setListed(true);

        assertThatThrownBy(() -> documents.saveAndFlush(document))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("document_listed_only_public");
    }

    // Второй рубеж: даже если строка окажется в базе в обход схемы — миграцией,
    // ручным update, восстановлением из старого дампа, — перечень её не отдаст.
    @Test
    void listingSelectsOnlyPublicDocuments() {
        assertThat(documents.findByListedTrueAndSensitivityOrderByDocGroupAscTitleAsc("public"))
                .isNotEmpty()
                .allSatisfy(d -> assertThat(d.getSensitivity()).isEqualTo("public"));
    }

    @Test
    void seedMatchesTheDocumentsPage() {
        assertThat(documents.findAll()).hasSize(10);
        assertThat(documents.findByListedTrueOrderByDocGroupAscTitleAsc()).hasSize(10);
        assertThat(documents.findAll())
                .as("ни один документ ещё не согласован к публикации")
                .allSatisfy(d -> assertThat(d.isPublished()).isFalse());
    }
}
