package ru.vedal.portal.documents;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.ObjectCannedACL;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.io.InputStream;
import java.util.Optional;

// Полная реализация порта. Локально это MinIO, в облаке — Yandex Object
// Storage: протокол один, различаются адрес, ключи и имена бакетов.
//
// Приватность закреплена бакетом, а не кодом: vedal-documents закрыт целиком,
// и даже ошибка в контроллере не сделает закрытый документ доступным по прямой
// ссылке. Подписанные ссылки сознательно не используются — выданная ссылка
// живёт до истечения срока и переживает снятие документа с публикации,
// а обращение по ней не попадает в журнал.
@Component
@ConditionalOnProperty(name = "vedal.storage.kind", havingValue = "s3")
public class S3FileStorage implements FileStorage {

    private static final Logger log = LoggerFactory.getLogger(S3FileStorage.class);

    private final S3Client s3;
    private final StorageProperties properties;

    public S3FileStorage(S3Client s3, StorageProperties properties) {
        this.s3 = s3;
        this.properties = properties;
    }

    @Override
    public void put(Area area, String key, InputStream data, long size, String contentType) {
        StorageLimits.check(size, maxFileSize());

        // Медиа кладётся с public-read, документы — нет, и различие здесь
        // не косметическое.
        //
        // Что было. ACL не выставлялся вовсе. На машине разработчика это
        // не всплывало: MinIO там открыт на чтение политикой бакета, и
        // приватный объект всё равно отдавался. На ВМ политики нет — доступ
        // выдан пообъектно, — и снимок, загруженный редактором через админку,
        // лёг бы приватным. Сайт показал бы вместо него пустое место, а в
        // журнале приложения при этом стояло бы «файл сохранён».
        //
        // Ровно так уже случилось с четырьмя фотографиями, которые заливал
        // media-seed: в бакете они были, но отдавали 403.
        //
        // DOCUMENTS остаётся без ACL намеренно. Закрытый документ отдаётся
        // только через контроллер, который проверяет публикацию и пишет
        // обращение в журнал; public-read на нём означал бы выдачу мимо
        // проверки и мимо аудита — то самое, ради чего бакеты разделены.
        var request = PutObjectRequest.builder()
                .bucket(bucket(area))
                .key(key)
                .contentType(contentType == null ? StorageLimits.contentType(key) : contentType)
                .contentLength(size)
                .acl(area == Area.MEDIA ? ObjectCannedACL.PUBLIC_READ : ObjectCannedACL.PRIVATE)
                .build();

        // fromInputStream с известной длиной: поток уходит в сеть как есть.
        // fromBytes здесь означал бы держать двадцать мегабайт в куче
        // на каждую параллельную загрузку.
        s3.putObject(request, RequestBody.fromInputStream(data, size));
        log.info("файл {}/{} сохранён в хранилище ({} байт)", bucket(area), key, size);
    }

    @Override
    public Optional<Stored> open(Area area, String key) {
        try {
            var response = s3.getObject(GetObjectRequest.builder()
                    .bucket(bucket(area))
                    .key(key)
                    .build());
            var meta = response.response();
            var contentType = meta.contentType() == null
                    ? StorageLimits.contentType(key)
                    : meta.contentType();
            return Optional.of(new Stored(response, meta.contentLength(), contentType));
        } catch (NoSuchKeyException e) {
            // Строка документа есть, а файла в хранилище нет. Для вызывающего
            // это «файла нет», а не отказ хранилища: он ответит 404.
            return Optional.empty();
        }
    }

    @Override
    public boolean exists(Area area, String key) {
        try {
            s3.headObject(HeadObjectRequest.builder().bucket(bucket(area)).key(key).build());
            return true;
        } catch (NoSuchKeyException e) {
            return false;
        }
    }

    @Override
    public void delete(Area area, String key) throws IOException {
        s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket(area)).key(key).build());
    }

    @Override
    public long maxFileSize() {
        return properties.getMaxFileSize().toBytes();
    }

    private String bucket(Area area) {
        var bucket = properties.getS3().getBuckets().get(area);
        if (bucket == null) {
            throw new IllegalStateException("Не задан бакет для области " + area);
        }
        return bucket;
    }
}
