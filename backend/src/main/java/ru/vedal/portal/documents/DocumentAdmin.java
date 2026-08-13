package ru.vedal.portal.documents;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.io.InputStream;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

// Вторая дверь модуля — для редактора. DocumentQuery отдаёт только перечень
// и опубликованные файлы; здесь видно всё, включая внутренние и
// конфиденциальные документы.
public interface DocumentAdmin {

    // Разделы перечня и уровни доступа закрыты проверками в схеме. Списки
    // продублированы здесь, чтобы админка нарисовала выбор, а не свободное
    // поле, в котором опечатка кончается отказом базы.
    List<String> GROUPS = List.of("Лицензирование", "Система качества",
            "Техническая документация", "Коммерческие материалы");
    List<String> SENSITIVITIES = List.of("public", "internal", "confidential");
    List<String> ACCESS_KINDS = List.of("pdf", "on_request", "pending");

    @Schema(name = "AdminDocumentRow", description = "Строка списка документов в админке.")
    record DocumentRow(UUID id, String slug, String title, String group, String subject,
                       String productSlug, String sensitivity, String access,
                       boolean listed, boolean published,
                       boolean hasFile, Long fileSize, String revision,
                       String approvedBy, Instant updatedAt,
                       @Schema(description = "Почему документ нельзя опубликовать прямо сейчас. "
                               + "`null` — можно. Считается по тем же правилам, что закрыты "
                               + "ограничениями схемы, чтобы кнопка объясняла отказ заранее.",
                               nullable = true)
                       String publishBlockedBy) {}

    @Schema(name = "AdminDocumentForm")
    record DocumentForm(

            @NotBlank
            @Pattern(regexp = "^[a-z0-9]+(?:-[a-z0-9]+)*$",
                    message = "Только латиница в нижнем регистре, цифры и дефис")
            String slug,

            @NotBlank @Size(max = 300) String title,

            @Schema(description = "Раздел перечня.",
                    allowableValues = {"Лицензирование", "Система качества",
                            "Техническая документация", "Коммерческие материалы"})
            @NotBlank String group,

            @Schema(description = "К чему относится документ.", example = "VEDAL R1, R2")
            @NotBlank @Size(max = 300) String subject,

            @Schema(description = "Изделие, к которому привязан документ.", nullable = true)
            @Size(max = 200) String productSlug,

            @Schema(description = "Уровень секретности. Опубликовать можно только `public` — "
                    + "это ограничение схемы, а не дисциплина редактора.",
                    allowableValues = {"public", "internal", "confidential"})
            @NotBlank String sensitivity,

            @Schema(description = "Планируемый уровень доступа, бейдж на сайте.",
                    allowableValues = {"pdf", "on_request", "pending"})
            @NotBlank String access,

            @Schema(description = "Строка видна в публичном перечне. Это не публикация файла.")
            boolean listed,

            @Size(max = 100) String revision,
            @Size(max = 200) String sourceOwner) {}

    // Загружаемый файл описан потоком, размером и типом, а не MultipartFile:
    // модуль documents не должен знать, что наверху именно веб-форма — тот же
    // путь понадобится разбору почты с вложением.
    record Upload(String filename, InputStream data, long size, String contentType) {}

    List<DocumentRow> allDocuments();

    DocumentRow document(UUID id);

    DocumentRow createDocument(DocumentForm form, String actor);

    DocumentRow updateDocument(UUID id, DocumentForm form, String actor);

    DocumentRow uploadFile(UUID id, Upload upload, String actor);

    DocumentRow setPublished(UUID id, boolean published, String actor);
}
