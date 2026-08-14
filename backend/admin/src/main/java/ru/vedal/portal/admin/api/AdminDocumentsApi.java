package ru.vedal.portal.admin.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import ru.vedal.portal.common.ConflictException;
import ru.vedal.portal.documents.DocumentAdmin;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/v1")
@Tag(name = "Админка: документы")
@SecurityRequirement(name = "keycloak")
public class AdminDocumentsApi {

    private final DocumentAdmin documents;

    public AdminDocumentsApi(DocumentAdmin documents) {
        this.documents = documents;
    }

    @Operation(summary = "Все документы",
            description = "Включая внутренние и конфиденциальные — их нет в публичном перечне. "
                    + "У каждой строки поле `publishBlockedBy` объясняет, почему кнопка "
                    + "публикации недоступна.")
    @GetMapping("/documents")
    public List<DocumentAdmin.DocumentRow> documents() {
        return documents.allDocuments();
    }

    @Operation(summary = "Справочники разделов, секретности и доступа",
            description = "Закрытые списки из проверок в схеме.")
    @GetMapping("/documents/vocabulary")
    public Map<String, List<String>> vocabulary() {
        return Map.of("groups", DocumentAdmin.GROUPS,
                "sensitivities", DocumentAdmin.SENSITIVITIES,
                "access", DocumentAdmin.ACCESS_KINDS);
    }

    @Operation(summary = "Документ")
    @GetMapping("/documents/{id}")
    public DocumentAdmin.DocumentRow document(@PathVariable UUID id) {
        return documents.document(id);
    }

    @Operation(summary = "Завести документ", description = "Создаётся без файла и без публикации.")
    @PostMapping("/documents")
    public ResponseEntity<DocumentAdmin.DocumentRow> create(
            @Valid @RequestBody DocumentAdmin.DocumentForm form, Authentication who) {
        var created = documents.createDocument(form, Actor.of(who));
        return ResponseEntity.created(URI.create("/api/admin/v1/documents/" + created.id()))
                .body(created);
    }

    @Operation(summary = "Правка карточки документа")
    @PutMapping("/documents/{id}")
    public DocumentAdmin.DocumentRow update(@PathVariable UUID id,
                                            @Valid @RequestBody DocumentAdmin.DocumentForm form,
                                            Authentication who) {
        return documents.updateDocument(id, form, Actor.of(who));
    }

    @Operation(summary = "Загрузить файл",
            description = """
                    Предел — 20 МБ на файл. Отказ приходит из разбора multipart,
                    то есть до того, как тело целиком попало в память приложения,
                    и отвечает `413` в формате problem+json.

                    Загрузка не публикует документ: публикация — отдельное действие.
                    """)
    @PostMapping(value = "/documents/{id}/file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public DocumentAdmin.DocumentRow upload(@PathVariable UUID id,
                                            @RequestPart("file") MultipartFile file,
                                            Authentication who) {
        if (file.isEmpty()) throw new ConflictException("Файл не выбран");

        try (var data = file.getInputStream()) {
            return documents.uploadFile(id, new DocumentAdmin.Upload(file.getOriginalFilename(),
                    data, file.getSize(), file.getContentType()), Actor.of(who));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Operation(summary = "Опубликовать документ",
            description = "Отклоняется, если документ не `public`, без файла или не в перечне. "
                    + "Причина приезжает в `409`, но та же тройка закрыта ограничениями схемы.")
    @PostMapping("/documents/{id}/publish")
    public DocumentAdmin.DocumentRow publish(@PathVariable UUID id, Authentication who) {
        return documents.setPublished(id, true, Actor.of(who));
    }

    @Operation(summary = "Снять документ с публикации",
            description = "Ссылка на файл перестаёт работать немедленно: ответы с файлами "
                    + "не кэшируются как раз для этого.")
    @PostMapping("/documents/{id}/unpublish")
    public DocumentAdmin.DocumentRow unpublish(@PathVariable UUID id, Authentication who) {
        return documents.setPublished(id, false, Actor.of(who));
    }
}
