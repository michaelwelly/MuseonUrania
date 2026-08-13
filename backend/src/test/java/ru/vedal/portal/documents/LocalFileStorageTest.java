package ru.vedal.portal.documents;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.util.unit.DataSize;
import ru.vedal.portal.common.PayloadTooLargeException;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Локальное хранилище проверяется без Postgres и без Docker: здесь нет
// ни базы, ни контекста — только поведение порта.
class LocalFileStorageTest {

    @TempDir
    Path root;

    private LocalFileStorage storage(long maxBytes) {
        var properties = new StorageProperties();
        properties.setRoot(root.toString());
        properties.setMaxFileSize(DataSize.ofBytes(maxBytes));
        return new LocalFileStorage(properties);
    }

    @Test
    void storedFileComesBackWithSizeAndType() throws IOException {
        var storage = storage(1024);
        storage.put(FileStorage.Area.DOCUMENTS, "opisanie.pdf", bytes("текст"), 10, "application/pdf");

        var stored = storage.open(FileStorage.Area.DOCUMENTS, "opisanie.pdf").orElseThrow();
        assertThat(stored.size()).isEqualTo(10);
        assertThat(stored.contentType()).isEqualTo("application/pdf");
        assertThat(new String(stored.data().readAllBytes(), StandardCharsets.UTF_8)).isEqualTo("текст");
    }

    // Области разведены физически, а не соглашением об именовании ключей:
    // один и тот же ключ в разных областях — это два разных файла.
    @Test
    void areasDoNotSeeEachOther() throws IOException {
        var storage = storage(1024);
        storage.put(FileStorage.Area.DOCUMENTS, "one.pdf", bytes("закрытый"), 16, "application/pdf");

        assertThat(storage.exists(FileStorage.Area.DOCUMENTS, "one.pdf")).isTrue();
        assertThat(storage.exists(FileStorage.Area.MEDIA, "one.pdf")).isFalse();
        assertThat(Files.exists(root.resolve("documents").resolve("one.pdf"))).isTrue();
    }

    @Test
    void fileOverTheLimitIsRefusedAndNothingIsWritten() {
        var storage = storage(20);

        assertThatThrownBy(() -> storage.put(FileStorage.Area.DOCUMENTS, "big.pdf",
                bytes("двадцать один байт"), 21, "application/pdf"))
                .isInstanceOf(PayloadTooLargeException.class)
                .hasMessageContaining("МБ");

        assertThat(storage.exists(FileStorage.Area.DOCUMENTS, "big.pdf")).isFalse();
    }

    // Ключ приходит из базы, но проверяем всё равно: строка, собранная
    // из slug'а, однажды приедет из места, где slug никто не проверял.
    @Test
    void keyCannotEscapeItsArea() {
        var storage = storage(1024);

        assertThatThrownBy(() -> storage.open(FileStorage.Area.MEDIA, "../documents/one.pdf"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("за пределы хранилища");
    }

    @Test
    void deleteRemovesTheFileAndIsQuietWhenThereIsNothingToRemove() throws IOException {
        var storage = storage(1024);
        storage.put(FileStorage.Area.MEDIA, "photo.jpg", bytes("снимок"), 12, "image/jpeg");

        storage.delete(FileStorage.Area.MEDIA, "photo.jpg");
        assertThat(storage.exists(FileStorage.Area.MEDIA, "photo.jpg")).isFalse();

        storage.delete(FileStorage.Area.MEDIA, "photo.jpg");
    }

    private static ByteArrayInputStream bytes(String text) {
        return new ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8));
    }
}
