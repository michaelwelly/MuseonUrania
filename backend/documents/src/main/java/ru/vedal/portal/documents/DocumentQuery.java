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
                    example = "vedal-r1-product-sheet")
            String slug,

            @Schema(description = "Название документа.", example = "Система реанимационная VEDAL R1")
            String title,

            @Schema(description = "Раздел перечня.", example = "Техническая документация")
            String group,

            @Schema(description = "К чему относится документ: изделие или организация.",
                    example = "VEDAL R1")
            String subject,

            @Schema(description = "Изделие, к которому привязан документ. `null` у общих документов.",
                    example = "vedal-r1", nullable = true)
            String productSlug,

            @Schema(description = "Как документ достаётся: `pdf` — файл на сайте, `on_request` — "
                    + "по запросу, `pending` — уточняется.",
                    allowableValues = {"pdf", "on_request", "pending"}, example = "pdf")
            String access,

            @Schema(description = "Файл согласован к публикации и доступен для скачивания.")
            boolean published,

            @Schema(description = "Ссылка на файл. Заполнена только у опубликованных — собирать её "
                    + "на стороне сайта значит однажды собрать её для закрытого документа.",
                    example = "/api/public/v1/documents/vedal-r1-product-sheet/file",
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

    /**
     * Файл документа из публичного перечня — соседу, которому нужно его
     * содержимое, а не отдача посетителю.
     *
     * <p>Нужен ровно одному: индексу Ведалины. Датащит приезжает файлом,
     * а в индекс попадает текст, и без этого документ виден ассистенту
     * одним названием карточки.
     *
     * <p><b>Отбор тот же, что у {@link #listedDocuments()}, плюс публикация.</b>
     * Не «любой файл по slug»: такой метод однажды позвали бы для закрытого
     * документа, и его содержимое уехало бы в индекс, а оттуда — в ответ
     * посетителю. Здесь недостижимость закрытого — свойство метода,
     * а не осторожность вызывающего.
     *
     * <p><b>Обращения в журнал не пишет.</b> {@link #download(String)} пишет,
     * и правильно делает: там за файлом пришёл человек. Индексация — не
     * посетитель, и её заходы в журнале скачиваний означали бы, что документ
     * запрашивали, хотя его никто не открывал.
     */
    Optional<Download> listedFile(String slug);

    /** Документ по идентификатору — для соседа, который на него ссылается. */
    Optional<Ref> ref(UUID id);

    /** Те же ссылки пачкой: карточка со списком вложений не должна давать N+1. */
    List<Ref> refs(Collection<UUID> ids);

    Download download(String slug);
}
