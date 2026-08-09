package ru.vedal.portal.documents;

import java.io.IOException;
import java.io.InputStream;
import java.util.Optional;

// Порт наружу. Ранняя реализация — локальный каталог, полная — Yandex Object
// Storage. Приватность и подписанные ссылки — свойство реализации порта,
// а не вызывающего кода: переезд на S3 не должен случайно раскрыть закрытый файл.
public interface FileStorage {

    record Stored(InputStream data, long size, String contentType) {}

    void put(String key, InputStream data, String contentType) throws IOException;

    Optional<Stored> open(String key) throws IOException;

    boolean exists(String key);
}
