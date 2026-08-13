package ru.vedal.portal.documents;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

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

    record Download(String filename, FileStorage.Stored stored) {}

    List<Card> listedDocuments();

    Download download(String slug);
}
