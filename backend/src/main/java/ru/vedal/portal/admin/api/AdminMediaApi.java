package ru.vedal.portal.admin.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import ru.vedal.portal.audit.AuditLog;
import ru.vedal.portal.common.ConflictException;
import ru.vedal.portal.documents.FileStorage;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

// Снимки изделий и иллюстрации новостей. Они уезжают в открытый на чтение
// бакет и раздаются мимо приложения: гонять картинки через портал значит
// класть на него трафик, который должен идти в CDN.
//
// Отсюда и разделение с документами: документ отдаётся через контроллер
// с проверкой публикации и записью в журнал, снимок — нет. Это два разных
// уровня доступа, и они разведены бакетами, а не папками.
@RestController
@RequestMapping("/api/admin/v1")
@Tag(name = "Админка: изображения")
@SecurityRequirement(name = "keycloak")
public class AdminMediaApi {

    // Куда можно класть. Свободный путь означал бы, что редактор однажды
    // положит файл в photos/../что-угодно.
    private static final Set<String> FOLDERS = Set.of("products", "news", "production");

    private static final Set<String> EXTENSIONS = Set.of(".jpg", ".jpeg", ".png", ".webp", ".svg");

    @Schema(name = "UploadedMedia")
    public record Uploaded(
            @Schema(description = "Путь для поля imageSrc. Без хоста: имя хоста — свойство "
                    + "окружения, и в данных ему не место.",
                    example = "/photos/products/vedal-a-2000.jpg")
            String path,
            long size) {}

    private final FileStorage storage;
    private final AuditLog audit;

    public AdminMediaApi(FileStorage storage, AuditLog audit) {
        this.storage = storage;
        this.audit = audit;
    }

    @Operation(summary = "Загрузить изображение",
            description = """
                    Кладёт файл в открытый на чтение бакет и возвращает путь для поля
                    `imageSrc`. Имя файла собирается из `name`, а не из имени на диске
                    редактора: пробелы, кириллица и `..` в ключе объектного хранилища
                    ничем хорошим не заканчиваются.
                    """)
    @PostMapping(value = "/media", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Uploaded upload(@RequestPart("file") MultipartFile file,
                           @RequestParam String folder,
                           @io.swagger.v3.oas.annotations.Parameter(
                                   description = "Имя файла без расширения. Только латиница "
                                           + "в нижнем регистре, цифры и дефис.",
                                   example = "vedal-a-2000")
                           @RequestParam String name,
                           Authentication who) {
        if (file.isEmpty()) throw new ConflictException("Файл не выбран");
        if (!FOLDERS.contains(folder)) {
            throw new ConflictException("Неизвестный каталог: " + folder
                    + ". Допустимые: " + String.join(", ", List.copyOf(FOLDERS)));
        }
        if (!name.matches("^[a-z0-9]+(?:-[a-z0-9]+)*$")) {
            throw new ConflictException("Имя файла: только латиница в нижнем регистре, "
                    + "цифры и дефис");
        }

        var extension = extension(file.getOriginalFilename());
        if (!EXTENSIONS.contains(extension)) {
            throw new ConflictException("Не изображение: " + extension
                    + ". Допустимые: " + String.join(", ", List.copyOf(EXTENSIONS)));
        }

        var key = "photos/" + folder + "/" + name + extension;
        try (var data = file.getInputStream()) {
            storage.put(FileStorage.Area.MEDIA, key, data, file.getSize(), file.getContentType());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }

        audit.recordIndependently(Actor.of(who), "media.upload", "media", key,
                Map.of("size", file.getSize()));
        return new Uploaded("/" + key, file.getSize());
    }

    private static String extension(String filename) {
        if (filename == null) return "";
        var dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot).toLowerCase(Locale.ROOT);
    }
}
