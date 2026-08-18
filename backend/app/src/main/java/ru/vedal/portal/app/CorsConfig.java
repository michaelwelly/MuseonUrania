package ru.vedal.portal.app;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

// Сайт живёт на своём адресе, API — на своём, поэтому формы и Ведалина ходят
// сюда кросс-доменно. Каталог, новости и документы фронтенд читает на сборке
// с сервера, там CORS не участвует, — но правило одно на все три публичные
// двери, чтобы не заводить исключений.
//
// Что сюда сознательно не попало:
//
// - `allowCredentials`. Ни у одной двери нет cookie-аутентификации:
//   Forms API опознаёт повтор по `Idempotency-Key`, админское API — по
//   заголовку Authorization. Включать передачу учётных данных не для чего,
//   а с ней браузер запрещает `*` в списке источников и цена ошибки
//   в конфигурации растёт.
//
// `/api/admin/**` сюда попал, и это безопасно ровно потому, что у портала
// не осталось ни одной двери с cookie-аутентификацией: запрос опознаётся
// по заголовку Authorization, который чужая страница проставить не может.
// Разрешение приходить с адреса админки не даёт чужой вкладке ничего.
//
// Списка источников два, и это разные периметры. Сайт открыт всему миру,
// админка — нет, и адрес сайта не должен давать доступа к двери правки.
@Configuration
public class CorsConfig {

    // Ровно те заголовки, которые шлёт фронтенд. Открывать список целиком
    // незачем: заголовок, которого нет в этом перечне, — повод посмотреть,
    // кто и зачем его добавил.
    private static final List<String> PUBLIC_HEADERS =
            List.of("Content-Type", "Idempotency-Key");

    private static final List<String> ADMIN_HEADERS =
            List.of("Content-Type", "Authorization");

    private static final List<String> PUBLIC_DOORS =
            List.of("/api/public/**", "/api/forms/**", "/api/assistant/**");

    private static final String ADMIN_DOOR = "/api/admin/**";

    private final List<String> origins;
    private final List<String> adminOrigins;

    public CorsConfig(@Value("${vedal.web.allowed-origins}") String allowedOrigins,
                      // Адрес админки задаётся отдельно от адреса сайта: это
                      // разные периметры, и открывать админскую дверь всему,
                      // чему открыт публичный сайт, незачем. Пусто — берём
                      // список сайта, чтобы разработка заводилась без лишней
                      // переменной.
                      @Value("${vedal.web.admin-origins:}") String allowedAdminOrigins) {
        this.origins = split(allowedOrigins);
        var admin = split(allowedAdminOrigins);
        this.adminOrigins = admin.isEmpty() ? this.origins : admin;
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        var source = new UrlBasedCorsConfigurationSource();
        PUBLIC_DOORS.forEach(door -> source.registerCorsConfiguration(door,
                config(origins, List.of("GET", "POST", "OPTIONS"), PUBLIC_HEADERS)));
        source.registerCorsConfiguration(ADMIN_DOOR,
                config(adminOrigins, List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"), ADMIN_HEADERS));
        return source;
    }

    private static CorsConfiguration config(List<String> origins, List<String> methods,
                                            List<String> headers) {
        var config = new CorsConfiguration();
        // Именно allowedOrigins, а не allowedOriginPatterns: шаблон легко
        // расширить до `https://*` и не заметить этого на ревью.
        config.setAllowedOrigins(origins);
        config.setAllowedMethods(methods);
        config.setAllowedHeaders(headers);
        config.setAllowCredentials(false);
        // Preflight на каждую отправку формы — лишний круг к серверу.
        config.setMaxAge(3600L);
        return config;
    }

    private static List<String> split(String value) {
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toList();
    }
}
