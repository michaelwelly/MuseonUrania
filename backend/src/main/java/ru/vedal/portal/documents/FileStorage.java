package ru.vedal.portal.documents;

import java.io.IOException;
import java.io.InputStream;
import java.util.Optional;

// Порт наружу. Ранняя реализация — локальный каталог, полная — S3: локально
// MinIO, в облаке Yandex Object Storage. Приватность, подписанные ссылки
// и предел размера — свойства реализации порта, а не вызывающего кода:
// переезд на S3 не должен случайно раскрыть закрытый файл.
public interface FileStorage {

    // Область хранения, а не просто префикс ключа. Приватность закреплена
    // за областью: DOCUMENTS лежит в закрытом бакете и отдаётся только через
    // контроллер, который проверяет публикацию и пишет обращение в журнал;
    // MEDIA лежит в бакете, открытом на чтение, и раздаётся мимо приложения.
    //
    // Развести их отдельными бакетами, а не папками в одном, — требование:
    // политика доступа в S3 задаётся на бакет, и «приватная папка внутри
    // публичного бакета» — это публичная папка.
    enum Area {
        DOCUMENTS,
        MEDIA;

        // Имя области в конфигурации и в путях локального хранилища.
        public String slug() {
            return name().toLowerCase();
        }
    }

    record Stored(InputStream data, long size, String contentType) {}

    // Размер передаётся, а не вычисляется по потоку: S3 обязан знать длину
    // тела до отправки, и вычислять её значит прочитать файл в память целиком.
    // Он же — единственное место, где предел размера проверяется для всех
    // вызывающих, а не только для тех, кто пришёл через multipart.
    void put(Area area, String key, InputStream data, long size, String contentType) throws IOException;

    Optional<Stored> open(Area area, String key) throws IOException;

    boolean exists(Area area, String key);

    // Удаление файла при замене редакции. Строку документа не трогает:
    // за неё отвечает домен.
    void delete(Area area, String key) throws IOException;

    // Предел размера одного файла. Дверь загрузки согласует с ним свой лимит
    // тела, а сообщение об отказе называет число, а не «слишком большой файл».
    long maxFileSize();
}
