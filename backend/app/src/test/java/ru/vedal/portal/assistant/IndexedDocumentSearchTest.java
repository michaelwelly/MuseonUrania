package ru.vedal.portal.assistant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;
import ru.vedal.portal.PostgresTestBase;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class IndexedDocumentSearchTest extends PostgresTestBase {

    @Autowired
    JdbcClient jdbc;

    private final Retrieval.Passage card = new Retrieval.Passage(
            new LlmEngine.Source("Synthetic datasheet", "/api/public/v1/documents/synthetic/file", "document"),
            "Published document metadata");

    private void index(String visibility, String url, String... texts) {
        var id = UUID.randomUUID();
        jdbc.sql("""
                        insert into knowledge_source
                            (id, kind, external_id, title, url, visibility, language, checksum)
                        values (:id, 'document', :externalId, 'Synthetic datasheet', :url, :visibility, 'ru', 'test')
                        """)
                .param("id", id).param("externalId", id.toString())
                .param("url", url).param("visibility", visibility).update();
        for (var at = 0; at < texts.length; at++) {
            jdbc.sql("""
                            insert into knowledge_chunk (id, source_id, position, text, model, embedding)
                            values (:id, :source, :position, :text, 'synthetic', cast(:vector as vector))
                            """)
                    .param("id", UUID.randomUUID()).param("source", id).param("position", at)
                    .param("text", texts[at])
                    .param("vector", KnowledgeIndex.literal(new SyntheticEmbeddings().ofDocument("cube")))
                    .update();
        }
    }

    private Retrieval search() {
        Retrieval words = (question, scope) -> List.of(card);
        return new RagRetrieval((question, scope) -> List.of(), new IndexedDocumentSearch(words, jdbc));
    }

    @Test
    void fallbackIncludesTheTableFromLaterInTheMatchedPdf() {
        index("public", card.source().url(), "Synthetic introduction", "Synthetic width: 42 mm");
        index("public", "/api/public/v1/documents/other/file", "Unrelated width: 99 mm");

        var found = search().find("Synthetic width?", LlmEngine.Scope.PUBLIC);

        assertThat(found).hasSize(1);
        assertThat(found.getFirst().source()).isEqualTo(card.source());
        assertThat(found.getFirst().text())
                .contains("Published document metadata", "Synthetic introduction", "Synthetic width: 42 mm")
                .doesNotContain("Unrelated width");
    }

    @Test
    void missingIndexKeepsTheOriginalCard() {
        assertThat(search().find("Synthetic width?", LlmEngine.Scope.PUBLIC)).containsExactly(card);
    }

    @Test
    void internalTextIsOnlyAvailableToStaff() {
        index("internal", card.source().url(), "Internal synthetic width: 42 mm");

        assertThat(search().find("Synthetic width?", LlmEngine.Scope.PUBLIC)).containsExactly(card);
        assertThat(search().find("Synthetic width?", LlmEngine.Scope.STAFF).getFirst().text())
                .contains("Internal synthetic width");
    }

    @Test
    void sharedDocumentsPageDoesNotAttachAnotherDocumentsText() {
        index("public", "/documents/", "Another document");
        var pending = new Retrieval.Passage(new LlmEngine.Source("Pending", "/documents/", "document"), "Pending");
        var search = new IndexedDocumentSearch((question, scope) -> List.of(pending), jdbc);

        assertThat(search.find("Pending?", LlmEngine.Scope.PUBLIC)).containsExactly(pending);
    }

    @Test
    void longDocumentsHaveABoundedContext() {
        index("public", card.source().url(), "Chunk 0", "Chunk 1", "Chunk 2", "Chunk 3", "Chunk 4",
                "Chunk 5", "Chunk 6", "Chunk 7", "Chunk 8");

        assertThat(search().find("Synthetic width?", LlmEngine.Scope.PUBLIC).getFirst().text())
                .contains("Chunk 0", "Chunk 7").doesNotContain("Chunk 8");
    }
}
