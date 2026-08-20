package ru.vedal.portal.documents;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

// Единственное, что модуль показывает соседям — включая ассистента, которому
// нужны только опубликованные документы.
public interface DocumentQuery {

    @Schema(name = "DocumentCard",
            description = "Строка перечня документов. В перечень попадают и те документы, файла "
                    + "у которых ещё нет: страница показывает их вместе со статусом доступа, "
                    + "и такая строка ведёт на запрос, а не на скачивание.")
    record Card(

            @Schema(description = "Идентификатор в URL.",
                    example = "registracionnoe-udostoverenie-vedal-r1-r2")
            String slug,

            @Schema(description = "Название документа.", example = "Регистрационное удостоверение")
            String title,

            @Schema(description = "Раздел перечня.", example = "Лицензирование")
            String group,

            @Schema(description = "К чему относится документ: изделие или организация.",
                    example = "VEDAL R1, R2")
            String subject,

            @Schema(description = "Изделие, к которому привязан документ. `null` у общих документов.",
                    example = "vedal-r1-r2", nullable = true)
            String productSlug,

            @Schema(description = "Как документ достаётся: `pdf` — файл на сайте, `on_request` — "
                    + "по запросу, `pending` — уточняется.",
                    allowableValues = {"pdf", "on_request", "pending"}, example = "pdf")
            String access,

            @Schema(description = "Файл согласован к публикации и доступен для скачивания.")
            boolean published,

            @Schema(description = "Ссылка на файл. Заполнена только у опубликованных — собирать её "
                    + "на стороне сайта значит однажды собрать её для закрытого документа.",
                    example = "/api/public/v1/documents/opisanie-izdeliya-vedal-r1-r2/file",
                    nullable = true)
            String fileUrl) {}

    @Schema(name = "DocumentRef", description = """
            Документ, на который ссылается сосед. Ровно столько, сколько нужно,
            чтобы показать ссылку и решить, можно ли её отдавать клиенту:
            ни файла, ни доступа к самой карточке сосед не получает.
            """)
    record Ref(UUID id, String slug, String title,

               @Schema(description = "Документ согласован к публикации.")
               boolean approved) {}

    record Download(String filename, FileStorage.Stored stored) {}

    /** Публичный перечень: только public и только то, что стоит в перечне. */
    List<Card> listedDocuments();

    /**
     * Материалы, доступные сотруднику после входа. §10.3 плана.
     *
     * Сюда входят public и internal. Confidential не входит: §7.4 отдаёт такие
     * документы «только по отдельному разрешению», а вход в админку отдельным
     * разрешением не является. Ассистент их не индексирует вовсе — не потому,
     * что фильтрует ответ, а потому что они не попадают к нему в контекст.
     */
    List<Card> staffDocuments();

    /** Документ по идентификатору — для соседа, который на него ссылается. */
    Optional<Ref> ref(UUID id);

    /** Те же ссылки пачкой: карточка со списком вложений не должна давать N+1. */
    List<Ref> refs(Collection<UUID> ids);

    Download download(String slug);
}
