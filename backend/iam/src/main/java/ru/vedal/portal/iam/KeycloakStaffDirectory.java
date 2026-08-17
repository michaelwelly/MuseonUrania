package ru.vedal.portal.iam;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * Справочник сотрудников из Keycloak.
 *
 * Читает список пользователей realm'а через административное API. Ходит
 * туда служебной учётной записью клиента `vedal-portal` — тем же клиентом,
 * для которого выписан токен админки, но по потоку client_credentials:
 * пользователь тут ни при чём, портал спрашивает от своего имени.
 *
 * Прав нужно ровно одно — `view-users` из `realm-management`. Больше давать
 * нельзя: с `manage-users` утёкший секрет клиента означает не «прочитали
 * список сотрудников», а «завели себе учётную запись администратора».
 *
 * Два адреса Keycloak, и это та же история, что с издателем и JWKS
 * в KeycloakDecoderConfig: внутренний адрес для запросов из docker-сети,
 * внешний — тот, что стоит в токене. Здесь нужен внутренний.
 */
class KeycloakStaffDirectory implements StaffDirectory {

    private static final Logger log = LoggerFactory.getLogger(KeycloakStaffDirectory.class);

    /** Сколько живёт прочитанный список. */
    private static final Duration TTL = Duration.ofMinutes(2);

    /** Потолок выборки. Realm на шестьдесят сотрудников в него укладывается
     *  с запасом, а без него Keycloak отдаёт первую сотню молча. */
    private static final int LIMIT = 500;

    private final RestClient http;
    private final String base;
    private final String realm;
    private final String clientId;
    private final String clientSecret;

    // Список сотрудников меняется несколько раз в год, а спрашивают его
    // на каждом открытии карточки. Без кеша каждый показ формы — это поход
    // в Keycloak и его же токен, выписанный заново.
    private volatile List<Person> cached = List.of();
    private volatile Instant readAt = Instant.EPOCH;

    KeycloakStaffDirectory(RestClient.Builder http, String base, String realm,
                           String clientId, String clientSecret) {
        this.http = http.build();
        this.base = base.replaceAll("/+$", "");
        this.realm = realm;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    @Override
    public List<Person> staff() {
        if (Duration.between(readAt, Instant.now()).compareTo(TTL) < 0) {
            return cached;
        }
        try {
            var fresh = read();
            cached = fresh;
            readAt = Instant.now();
            return fresh;
        } catch (RuntimeException e) {
            // Keycloak недоступен — отдаём прошлый список, а не пустой.
            // Пустой справочник в форме читается как «сотрудников нет»
            // и мешает работать; устаревший на две минуты — не мешает.
            log.warn("Не удалось прочитать сотрудников из Keycloak, отдаём прошлый список: {}",
                    e.getMessage());
            readAt = Instant.now();
            return cached;
        }
    }

    private List<Person> read() {
        var token = serviceToken();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> users = http.get()
                .uri(base + "/admin/realms/" + realm + "/users?max=" + LIMIT)
                .header("Authorization", "Bearer " + token)
                .retrieve()
                .body(List.class);

        if (users == null) return List.of();

        return users.stream()
                .map(KeycloakStaffDirectory::person)
                .filter(p -> !p.login().isBlank())
                .sorted(Comparator.comparing(Person::label, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private static Person person(Map<String, Object> raw) {
        var login = text(raw.get("username"));
        var first = text(raw.get("firstName"));
        var last = text(raw.get("lastName"));
        var name = (first + " " + last).trim();
        // enabled отсутствует у учётной записи, заведённой импортом realm'а
        // без явного поля: по смыслу Keycloak это «включена».
        var enabled = !Boolean.FALSE.equals(raw.get("enabled"));
        return new Person(login, name.isBlank() ? null : name, enabled);
    }

    private static String text(Object value) {
        return value == null ? "" : value.toString();
    }

    private String serviceToken() {
        @SuppressWarnings("unchecked")
        Map<String, Object> answer = http.post()
                .uri(base + "/realms/" + realm + "/protocol/openid-connect/token")
                .header("Content-Type", "application/x-www-form-urlencoded")
                .body("grant_type=client_credentials&client_id=" + clientId
                        + "&client_secret=" + clientSecret)
                .retrieve()
                .body(Map.class);

        var token = answer == null ? null : answer.get("access_token");
        if (token == null) {
            throw new IllegalStateException(
                    "Keycloak не выдал токен служебной учётной записи клиента " + clientId);
        }
        return token.toString();
    }
}
