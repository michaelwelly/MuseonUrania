package ru.vedal.portal.documents;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;

import java.util.Map;

// Настройки хранилища. Собраны в один класс, потому что предел размера,
// выбор реализации и адреса бакетов должны читаться вместе: разъехавшись
// по разным местам, они разъезжаются и по значениям.
@ConfigurationProperties(prefix = "vedal.storage")
public class StorageProperties {

    public enum Kind { LOCAL, S3 }

    // Выбор явный, а не «какой бин нашёлся»: молчаливое переключение
    // хранилища сборкой classpath — источник сюрпризов на развёртывании.
    // Тем же способом выбирается EventPublisher.
    private Kind kind = Kind.LOCAL;

    // Корень локального хранилища. Наружу каталог не раздаётся.
    private String root = "./var/documents";

    // Предел размера одного файла. Двадцать мегабайт — рабочий размер
    // датащита с иллюстрациями; всё, что больше, приезжает не через портал.
    //
    // Значение согласуется с тремя местами сразу: spring.servlet.multipart,
    // лимит тела на API Gateway и client_max_body_size на прокси. Меньший
    // лимит выше по цепочке роняет загрузку с 413 до приложения, и редактор
    // видит страницу прокси вместо внятного отказа.
    private DataSize maxFileSize = DataSize.ofMegabytes(20);

    private final S3 s3 = new S3();

    public Kind getKind() { return kind; }
    public void setKind(Kind kind) { this.kind = kind; }
    public String getRoot() { return root; }
    public void setRoot(String root) { this.root = root; }
    public DataSize getMaxFileSize() { return maxFileSize; }
    public void setMaxFileSize(DataSize maxFileSize) { this.maxFileSize = maxFileSize; }
    public S3 getS3() { return s3; }

    public static class S3 {

        // Адрес хранилища. Локально MinIO, в облаке
        // https://storage.yandexcloud.net.
        private String endpoint = "http://localhost:9000";

        // У Yandex Object Storage регион один — ru-central1. SDK требует
        // непустое значение для подписи запроса, даже когда хранилище его
        // не использует.
        private String region = "ru-central1";

        private String accessKey = "";
        private String secretKey = "";

        // MinIO по умолчанию адресует бакет путём, а не поддоменом:
        // bucket.localhost в разработке не разрешается в адрес.
        private boolean pathStyle = true;

        // Бакет на область. DOCUMENTS закрыт полностью, MEDIA открыт
        // на s3:GetObject без перечисления — политика задана в compose.yaml.
        private Map<FileStorage.Area, String> buckets = Map.of(
                FileStorage.Area.DOCUMENTS, "vedal-documents",
                FileStorage.Area.MEDIA, "vedal-media");

        public String getEndpoint() { return endpoint; }
        public void setEndpoint(String endpoint) { this.endpoint = endpoint; }
        public String getRegion() { return region; }
        public void setRegion(String region) { this.region = region; }
        public String getAccessKey() { return accessKey; }
        public void setAccessKey(String accessKey) { this.accessKey = accessKey; }
        public String getSecretKey() { return secretKey; }
        public void setSecretKey(String secretKey) { this.secretKey = secretKey; }
        public boolean isPathStyle() { return pathStyle; }
        public void setPathStyle(boolean pathStyle) { this.pathStyle = pathStyle; }
        public Map<FileStorage.Area, String> getBuckets() { return buckets; }
        public void setBuckets(Map<FileStorage.Area, String> buckets) { this.buckets = buckets; }
    }
}
