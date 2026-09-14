package ru.vedal.portal.assistant;

import org.springframework.jdbc.core.simple.JdbcClient;

import java.util.List;

/** Adds indexed PDF text to documents identified by the catalogue's word search. */
final class IndexedDocumentSearch implements Retrieval {

    private static final int MAX_CHUNKS = 8;

    private final Retrieval words;
    private final JdbcClient jdbc;

    IndexedDocumentSearch(Retrieval words, JdbcClient jdbc) {
        this.words = words;
        this.jdbc = jdbc;
    }

    @Override
    public List<Passage> find(String question, LlmEngine.Scope scope) {
        return words.find(question, scope).stream()
                .map(passage -> expand(passage, scope))
                .toList();
    }

    private Passage expand(Passage passage, LlmEngine.Scope scope) {
        if (!"document".equals(passage.source().kind())) return passage;
        if (!passage.source().url().endsWith("/file")) return passage;

        var visibility = scope == LlmEngine.Scope.STAFF
                ? List.of("public", "internal") : List.of("public");
        // Word search already checked current publication/access. Read only that
        // source and bound the context so a long manual cannot exhaust the prompt.
        var chunks = jdbc.sql("""
                        select c.text
                        from knowledge_chunk c
                        join knowledge_source s on s.id = c.source_id
                        where s.kind = 'document' and s.url = :url
                          and s.visibility in (:visibility)
                        order by c.position
                        limit :limit
                        """)
                .param("url", passage.source().url())
                .param("visibility", visibility)
                .param("limit", MAX_CHUNKS)
                .query(String.class)
                .list();
        if (chunks.isEmpty()) return passage;
        return new Passage(passage.source(), passage.text() + "\n\n" + String.join("\n\n", chunks));
    }
}
