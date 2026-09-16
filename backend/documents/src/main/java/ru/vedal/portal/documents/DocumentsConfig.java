package ru.vedal.portal.documents;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger log = LoggerFactory.getLogger(DocumentsConfig.class);

    /**
     * Открыт ли публичный раздел документов.
     *
     * <p>По умолчанию нет: витрина на сайте скрыта решением заказчика, и порталу
     * при пустом окружении полагается быть закрытым в ту же сторону, а не
     * отдавать файлы через дверь, которой на сайте нет.
     *
     * <p>Значение берётся из той же переменной окружения, что гасит витрину
     * и Ведалину, — {@code VEDAL_PUBLIC_DOCUMENTS_ENABLED} (см.
     * {@code application.properties}). Рубильник на сервере один, и одно его
     * положение означает одно состояние портала.
     */
    @Bean
    PublicDocumentsSection publicDocumentsSection(
            @Value("${vedal.documents.public-enabled:false}") boolean enabled) {
        if (!enabled) {
            log.info("Публичные двери документов закрыты "
                    + "(vedal.documents.public-enabled=false)");
        }
        return new PublicDocumentsSection(enabled);
    }

    @Bean
    RateLimit documentsListRateLimit(@Value("${vedal.documents.list-rate-limit.count:120}") int limit,
                                     @Value("${vedal.documents.rate-limit.window:PT10M}") Duration window) {
        return new RateLimit(limit, window);
    }

    @Bean
    RateLimit documentsDownloadRateLimit(
            @Value("${vedal.documents.download-rate-limit.count:120}") int limit,
            @Value("${vedal.documents.rate-limit.window:PT10M}") Duration window) {
        return new RateLimit(limit, window);
    }
}
