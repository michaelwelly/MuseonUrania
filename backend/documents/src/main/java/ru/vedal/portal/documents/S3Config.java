package ru.vedal.portal.documents;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;

import java.net.URI;

@Configuration
@ConditionalOnProperty(name = "vedal.storage.kind", havingValue = "s3")
public class S3Config {

    @Bean
    S3Client s3Client(StorageProperties properties) {
        var s3 = properties.getS3();

        if (s3.getAccessKey().isBlank() || s3.getSecretKey().isBlank()) {
            // Падаем на старте, а не на первой загрузке. SDK без ключей полез
            // бы в цепочку провайдеров по умолчанию — переменные окружения,
            // профиль, метаданные инстанса — и в лучшем случае отказал бы
            // через минуту, в худшем нашёл бы чужие ключи из окружения машины.
            throw new IllegalStateException(
                    "vedal.storage.kind=s3, но ключи доступа не заданы: "
                            + "VEDAL_S3_ACCESS_KEY и VEDAL_S3_SECRET_KEY");
        }

        return S3Client.builder()
                .endpointOverride(URI.create(s3.getEndpoint()))
                .region(Region.of(s3.getRegion()))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(s3.getAccessKey(), s3.getSecretKey())))
                // Бакет адресуется путём, а не поддоменом. Почему именно так
                // и почему это настройка, а не константа — в StorageProperties,
                // рядом со значением по умолчанию.
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(s3.isPathStyle())
                        .build())
                .build();
    }
}
