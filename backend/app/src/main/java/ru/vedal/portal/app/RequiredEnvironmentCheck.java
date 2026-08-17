package ru.vedal.portal.app;

import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

import java.util.List;
import java.util.Map;

// Проверка окружения до создания datasource.
//
// Зачем вообще: незаданная переменная в плейсхолдере без default подставляется
// текстом, и приложение падает на «'url' must start with "jdbc"». По такому
// сообщению не видно, что дело в переменной окружения.
//
// Почему BeanFactoryPostProcessor, а не EnvironmentPostProcessor: второй
// регистрируется файлом в META-INF, а spring-boot-maven-plugin при переупаковке
// оставляет META-INF в корне jar, откуда загрузчик приложения его не читает —
// проверка молча не работала бы именно в собранном виде, то есть на проде.
// BeanFactoryPostProcessor вызывается до инстанцирования синглтонов, значит
// до datasource, и регистрации не требует.
@Configuration
public class RequiredEnvironmentCheck {

    private static final List<String> DB = List.of(
            "VEDAL_DB_URL", "VEDAL_DB_USER", "VEDAL_DB_PASSWORD");

    private static final List<String> DEPLOYED = List.of(
            "VEDAL_DB_URL", "VEDAL_DB_USER", "VEDAL_DB_PASSWORD",
            // Роль, которой Flyway накатывает миграции. Она отдельная от той,
            // под которой приложение работает: рантайм не владеет схемой, иначе
            // отзыв прав из V15 и V16 он возвращает себе одной строкой.
            "VEDAL_DB_MIGRATION_USER", "VEDAL_DB_MIGRATION_PASSWORD",
            "VEDAL_PORTAL_URL", "VEDAL_STORAGE_ROOT", "VEDAL_ALLOWED_ORIGINS");

    private static final Map<String, List<String>> REQUIRED = Map.of(
            "prod", DEPLOYED,
            "staging", DEPLOYED,
            "internal", DEPLOYED,
            // В lab адрес портала и каталог хранилища имеют значения по умолчанию.
            "lab", DB);

    @Bean
    static BeanFactoryPostProcessor requiredEnvironment(Environment environment) {
        return beanFactory -> verify(environment);
    }

    static void verify(Environment environment) {
        for (var profile : environment.getActiveProfiles()) {
            var required = REQUIRED.get(profile);
            if (required == null) continue;

            var missing = required.stream()
                    .filter(name -> !environment.containsProperty(name))
                    .toList();

            if (!missing.isEmpty()) {
                throw new IllegalStateException(
                        "Профиль '" + profile + "' требует переменные окружения, они не заданы: "
                                + String.join(", ", missing)
                                + ". Значения по умолчанию есть только для локальной разработки — "
                                + "подставлять их в развёрнутой среде нельзя.");
            }

            if (DEPLOYED.equals(required)) verifyIdentityProvider(environment, profile);
        }
    }

    // Режим входа проверяется по значению, а не по наличию переменной, и это
    // разные проверки. vedal.iam.mode по умолчанию — 'local', то есть Basic
    // поверх учётных записей в базе; развёрнутая среда, где переменную забыли,
    // поднялась бы на нём молча. Проверка «переменная задана» такой прод пропустит
    // ровно один раз — когда в ней окажется 'local'.
    //
    // Запасной режим 'local' остаётся, но живёт в lab и на машине разработчика:
    // там, где нет провайдера идентичности. В прод он не едет, потому что MFA
    // настраивается в realm'е Keycloak, а у Basic её не бывает вовсе.
    private static void verifyIdentityProvider(Environment environment, String profile) {
        var mode = environment.getProperty("vedal.iam.mode", "local");

        if (!"keycloak".equals(mode)) {
            throw new IllegalStateException(
                    "Профиль '" + profile + "' требует vedal.iam.mode=keycloak, задано '" + mode
                            + "'. Режим 'local' — это Basic поверх учётных записей в базе, "
                            + "без второго фактора: он для разработки, не для развёрнутой среды. "
                            + "Задайте VEDAL_IAM_MODE=keycloak.");
        }
    }
}
