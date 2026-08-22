package ru.vedal.portal.app;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.tags.Tag;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

// Описание контракта портала. Групп две, и это не удобство раскладки:
//
//   vedal-public — двери под /api/public, /api/forms, /api/assistant. То,
//     по чему интегрируются снаружи; выкладывается в docs/api и читается теми,
//     у кого учётной записи портала нет и не будет.
//   vedal-admin — /api/admin/**. Контракт админки на фронте. Отдельной
//     группой, потому что смешать их значит выдать перечень дверей правки
//     тому, кому нужен только каталог.
//
// Серверных страниц /admin/** здесь нет, и это не пропуск: они принимают
// form-urlencoded и отвечают редиректом, а не JSON. springdoc такие
// обработчики не документирует, и затаскивать их сюда значит выдавать
// браузерный интерфейс за API для интеграции.
@Configuration
public class OpenApiConfig {

    static final String TAG_CATALOG = "Каталог";
    static final String TAG_NEWS = "Новости";
    static final String TAG_DOCUMENTS = "Документы";
    static final String TAG_FORMS = "Формы";
    static final String TAG_ASSISTANT = "Ассистент";

    private final String phone;
    private final String email;

    public OpenApiConfig(@Value("${vedal.contacts.phone}") String phone,
                         @Value("${vedal.contacts.email}") String email) {
        this.phone = phone;
        this.email = email;
    }

    @Bean
    OpenAPI portalOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("VEDAL Portal — публичное API")
                        .version("v1")
                        .description(description())
                        .contact(new Contact().name("VEDAL").email(email).url("tel:" + phone.replace(" ", ""))))
                .tags(List.of(
                        new Tag().name(TAG_CATALOG).description(
                                "Опубликованные изделия и категории. Неопубликованного в ответах нет: "
                                        + "фильтр стоит в запросе, а не в разметке сайта."),
                        new Tag().name(TAG_NEWS).description(
                                "Опубликованные материалы ленты."),
                        new Tag().name(TAG_DOCUMENTS).description(
                                "Перечень документов и выдача файлов. Перечень показывается вместе со "
                                        + "статусом доступа, даже когда файла ещё нет; скачивается только "
                                        + "опубликованное."),
                        new Tag().name(TAG_FORMS).description(
                                "Единственная дверь на запись снаружи. Авторизации нет — периметр здесь "
                                        + "составляют валидация, ловушка для ботов и лимит частоты."),
                        new Tag().name(TAG_ASSISTANT).description(
                                "Ведалина отвечает только по опубликованным материалам. Подходящих "
                                        + "источников нет — ответа нет, есть передача человеку.")))
                .components(new Components()
                        .addSchemas("ProblemDetail", problemDetail())
                        .addSecuritySchemes("keycloak", keycloak()));
    }

    // Одна группа на все публичные двери: интегратору удобнее один файл
    // спецификации, а разделение по дверям видно по тегам.
    //
    // Админское API исключено явным pathsToExclude, а не тем, что его «здесь
    // не перечислили»: /api/** покрывает и его тоже, и без этой строки перечень
    // дверей правки уехал бы в файл, который выкладывается в репозиторий
    // для внешних интеграторов.
    @Bean
    GroupedOpenApi publicApiSpec() {
        return GroupedOpenApi.builder()
                .group("vedal-public")
                .pathsToMatch("/api/**")
                .pathsToExclude("/api/admin/**")
                .build();
    }

    @Bean
    GroupedOpenApi adminApiSpec() {
        return GroupedOpenApi.builder()
                .group("vedal-admin")
                .pathsToMatch("/api/admin/**")
                .build();
    }

    // Как админка предъявляет себя. В режиме keycloak это токен из realm'а,
    // в запасном режиме local — HTTP Basic поверх учётных записей в базе.
    // В спецификации описан боевой вариант: запасной нужен разработке,
    // и выдавать его за контракт незачем.
    private static SecurityScheme keycloak() {
        return new SecurityScheme()
                .type(SecurityScheme.Type.HTTP)
                .scheme("bearer")
                .bearerFormat("JWT")
                .description("""
                        Токен доступа из Keycloak. Роли портала — `portal-admin`,
                        `portal-sales` и `portal-production` в `realm_access.roles`; токен без них
                        проходит проверку подписи и получает `403`.

                        В режиме `vedal.iam.mode=local` вместо этого работает
                        HTTP Basic поверх учётных записей портала — режим
                        разработки, не контракт.
                        """);
    }

    private String description() {
        return """
                Контракт сайта vedal-med.ru с серверной частью портала.

                Двери и их правила:

                - `/api/public/v1/**` — чтение опубликованного. Ответы кэшируются
                  на пять минут (`Cache-Control: max-age=300, public`); файлы
                  документов не кэшируются вовсе, потому что снятая с публикации
                  редакция не должна жить в кэшах прокси.
                - `/api/forms/v1/**` — приём заявок. Отвечает `202 Accepted`:
                  заявка принята, дальше её разбирает менеджер.
                - `/api/assistant/v1/**` — вопрос ассистенту.

                Ошибки во всех дверях — `application/problem+json` по RFC 9457.
                Разбор по полям формы приезжает в расширении `fields`.

                Кросс-доменные запросы разрешены только источникам из
                `vedal.web.allowed-origins`, без передачи учётных данных: у
                публичных дверей нет ни cookie, ни сессии. Повторную отправку
                заявки различает заголовок `Idempotency-Key`, а не пользователь.

                Лимит частоты считается по адресу клиента, у каждой двери свой
                бюджет: формы — 5 обращений за 10 минут, ассистент — 20.
                Превышение отдаёт `429`.
                """;
    }

    // ProblemDetail Spring отдаёт из общего обработчика, отдельного класса
    // в проекте нет — описываем схему руками, чтобы в спецификации она была
    // не пустым объектом.
    private static Schema<?> problemDetail() {
        return new Schema<>()
                .type("object")
                .description("Ошибка в формате RFC 9457, `application/problem+json`.")
                .addProperty("type", new StringSchema()
                        .format("uri")._default("about:blank"))
                .addProperty("title", new StringSchema()
                        .description("Причина словами — её показывает сайт.")
                        .example("Проверьте заполнение полей"))
                .addProperty("status", new Schema<Integer>()
                        .type("integer").format("int32").example(400))
                .addProperty("detail", new StringSchema().nullable(true))
                .addProperty("instance", new StringSchema().format("uri").nullable(true))
                .addProperty("fields", new Schema<>()
                        .type("object")
                        .description("Только у 400 от формы: поле → причина отказа. "
                                + "Форма показывает ошибку рядом с полем, а не одной строкой сверху.")
                        .additionalProperties(new StringSchema())
                        .example(java.util.Map.of(
                                "email", "Проверьте адрес почты",
                                "consent", "Без согласия отправить запрос нельзя")));
    }
}
