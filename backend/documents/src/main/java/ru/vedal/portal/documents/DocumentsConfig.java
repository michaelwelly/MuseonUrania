package ru.vedal.portal.documents;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import ru.vedal.portal.common.RateLimit;

import java.time.Duration;

// Лимит частоты на публичные двери документов.
//
// Разбор issue #65 назвал их дверью без счётчика: перечень и скачивание
// файла были открыты анониму без всякого предела — а скачивание тянет файл
// из хранилища (диск или S3) и держит поток обслуживания на всё время
// передачи. Это дешевле всего кладёт портал: запрос короткий, а стоимость
// на стороне сервера — самая высокая среди публичных дверей.
@Configuration
public class DocumentsConfig {

    @Bean
    RateLimit documentsRateLimit(@Value("${vedal.documents.rate-limit.count:30}") int limit,
                                 @Value("${vedal.documents.rate-limit.window:PT10M}") Duration window) {
        return new RateLimit(limit, window);
    }
}
