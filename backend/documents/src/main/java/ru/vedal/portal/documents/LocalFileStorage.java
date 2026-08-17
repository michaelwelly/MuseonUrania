package ru.vedal.portal.documents;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Optional;

// Локальный каталог вместо объектного хранилища. Режим разработки и запасной
// путь, если S3 недоступен: каталог наружу не раздаётся, файл отдаётся только
// через контроллер, который проверяет статус публикации и пишет обращение
// в журнал.
//
// Выбор реализации — свойством, а не @ConditionalOnMissingBean: порядок
// регистрации бинов-компонентов не определён, и «какой нашёлся» однажды
// означает локальный каталог на проде вместо хранилища.
@Component
@ConditionalOnProperty(name = "vedal.storage.kind", havingValue = "local", matchIfMissing = true)
public class LocalFileStorage implements FileStorage {

    private static final Logger log = LoggerFactory.getLogger(LocalFileStorage.class);

    private final Path root;
    private final long maxFileSize;

    public LocalFileStorage(StorageProperties properties) {
        this.root = Path.of(properties.getRoot()).toAbsolutePath().normalize();
        this.maxFileSize = properties.getMaxFileSize().toBytes();
    }

    @Override
    public void put(Area area, String key, InputStream data, long size, String contentType)
            throws IOException {
        StorageLimits.check(size, maxFileSize);
        var target = resolve(area, key);
        Files.createDirectories(target.getParent());
        Files.copy(data, target, StandardCopyOption.REPLACE_EXISTING);
        log.info("файл {}/{} сохранён ({} байт)", area.slug(), key, Files.size(target));
    }

    @Override
    public Optional<Stored> open(Area area, String key) throws IOException {
        var target = resolve(area, key);
        if (!Files.isRegularFile(target)) return Optional.empty();
        return Optional.of(new Stored(Files.newInputStream(target), Files.size(target),
                StorageLimits.contentType(key)));
    }

    @Override
    public boolean exists(Area area, String key) {
        return Files.isRegularFile(resolve(area, key));
    }

    @Override
    public void delete(Area area, String key) throws IOException {
        Files.deleteIfExists(resolve(area, key));
    }

    @Override
    public long maxFileSize() {
        return maxFileSize;
    }

    // Ключ приходит из базы, но проверяем всё равно: «..» в ключе вывел бы
    // чтение за пределы каталога хранилища — и за пределы области.
    private Path resolve(Area area, String key) {
        var base = root.resolve(area.slug()).normalize();
        var target = base.resolve(key).normalize();
        if (!target.startsWith(base)) {
            throw new IllegalArgumentException("Ключ выходит за пределы хранилища: " + key);
        }
        return target;
    }
}
