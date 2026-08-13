package ru.vedal.portal.app;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

// Сайт живёт на своём адресе, API — на своём, поэтому формы и Урания ходят
// сюда кросс-доменно. Каталог, новости и документы фронтенд читает на сборке
// с сервера, там CORS не участвует, — но правило одно на все три публичные
// двери, чтобы не заводить исключений.
//
// Что сюда сознательно не попало:
//
// - `/admin/**`. Админка работает по cookie-сессии; разрешить к ней
//   кросс-доменные запросы значит открыть путь к ней с чужой страницы.
//   Отсутствие CORS здесь — часть периметра, а не недосмотр.
// - `allowCredentials`. У публичных дверей нет ни cookie, ни сессии:
//   Forms API опознаёт повтор по `Idempotency-Key`, а не по пользователю.
//   Включать передачу учётных данных не для чего, а с ней браузер запрещает
//   `*` в списке источников и цена ошибки в конфигурации растёт.
@Configuration
public class CorsConfig {

    // Ровно те заголовки, которые шлёт фронтенд. Открывать список целиком
    // незачем: заголовок, которого нет в этом перечне, — повод посмотреть,
    // кто и зачем его добавил.
    private static final List<String> ALLOWED_HEADERS =
            List.of("Content-Type", "Idempotency-Key");

    private static final List<String> PUBLIC_DOORS =
            List.of("/api/public/**", "/api/forms/**", "/api/assistant/**");

    private final List<String> origins;

    public CorsConfig(@Value("${vedal.web.allowed-origins}") String allowedOrigins) {
        this.origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toList();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        var config = new CorsConfiguration();
        // Именно allowedOrigins, а не allowedOriginPatterns: шаблон легко
        // расширить до `https://*` и не заметить этого на ревью.
        config.setAllowedOrigins(origins);
        config.setAllowedMethods(List.of("GET", "POST", "OPTIONS"));
        config.setAllowedHeaders(ALLOWED_HEADERS);
        config.setAllowCredentials(false);
        // Preflight на каждую отправку формы — лишний круг к серверу.
        config.setMaxAge(3600L);

        var source = new UrlBasedCorsConfigurationSource();
        PUBLIC_DOORS.forEach(door -> source.registerCorsConfiguration(door, config));
        return source;
    }
}
