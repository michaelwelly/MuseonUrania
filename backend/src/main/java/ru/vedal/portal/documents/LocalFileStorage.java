package ru.vedal.portal.documents;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Optional;

// Локальный каталог вместо объектного хранилища, пока Yandex Cloud нет.
// Каталог наружу не раздаётся: файл отдаётся только через контроллер, который
// проверяет статус публикации и пишет обращение в журнал. Приватность по
// умолчанию — из functional_requirements.md.
@Component
@ConditionalOnMissingBean(name = "objectFileStorage")
public class LocalFileStorage implements FileStorage {

    private static final Logger log = LoggerFactory.getLogger(LocalFileStorage.class);

    private final Path root;

    public LocalFileStorage(@Value("${vedal.storage.root:./var/documents}") String root) {
        this.root = Path.of(root).toAbsolutePath().normalize();
    }

    @Override
    public void put(String key, InputStream data, String contentType) throws IOException {
        var target = resolve(key);
        Files.createDirectories(target.getParent());
        Files.copy(data, target, StandardCopyOption.REPLACE_EXISTING);
        log.info("файл {} сохранён ({} байт)", key, Files.size(target));
    }

    @Override
    public Optional<Stored> open(String key) throws IOException {
        var target = resolve(key);
        if (!Files.isRegularFile(target)) return Optional.empty();
        return Optional.of(new Stored(Files.newInputStream(target), Files.size(target), contentType(key)));
    }

    @Override
    public boolean exists(String key) {
        return Files.isRegularFile(resolve(key));
    }

    // Ключ приходит из базы, но проверяем всё равно: «..» в ключе вывел бы
    // чтение за пределы каталога хранилища.
    private Path resolve(String key) {
        var target = root.resolve(key).normalize();
        if (!target.startsWith(root)) {
            throw new IllegalArgumentException("Ключ выходит за пределы хранилища: " + key);
        }
        return target;
    }

    private static String contentType(String key) {
        var lower = key.toLowerCase();
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        return "application/octet-stream";
    }
}
