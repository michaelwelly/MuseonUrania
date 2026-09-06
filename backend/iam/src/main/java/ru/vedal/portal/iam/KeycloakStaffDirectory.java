package ru.vedal.portal.iam;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.Instant;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;

import java.util.Comparator;
import java.util.HashMap;
import java.util.Objects;
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

    @Override
    public void assignRoles(String login, List<String> roles) {
        // Ограничение №2 из StaffDirectory: только портальные роли.
        //
        // Проверка стоит здесь, а не только у двери. manage-users,
        // выданный служебной учётной записи, позволяет назначить ЛЮБУЮ
        // роль realm'а, включая realm-admin. Порт обещает, что через него
        // чужой ролью не распорядиться, и обещание должно держаться
        // независимо от того, кто позовёт его завтра.
        var чужие = roles.stream().filter(r -> !PORTAL_ROLES.contains(r)).toList();
        if (!чужие.isEmpty()) {
            throw new Rejected("Портал распоряжается только своими ролями. "
                    + "Не его: " + String.join(", ", чужие));
        }

        var token = serviceToken();
        var userId = userId(token, login);

        // Что есть сейчас и что вообще можно выдать. Обе двери отдают роль
        // вместе с её идентификатором, а он и нужен для назначения —
        // поэтому отдельного права на чтение справочника ролей
        // (view-realm) портал не просит.
        var сейчас = realmRoles(token, userId, "");
        var доступные = realmRoles(token, userId, "/available");

        var было = сейчас.keySet().stream().filter(PORTAL_ROLES::contains).toList();
        var стало = PORTAL_ROLES.stream().filter(roles::contains).toList();

        var снять = было.stream().filter(r -> !стало.contains(r)).map(сейчас::get).toList();
        var выдать = стало.stream().filter(r -> !было.contains(r)).map(доступные::get)
                .filter(Objects::nonNull).toList();

        // Сначала выдать, потом снять. Обратный порядок на мгновение
        // оставляет человека без единой роли: если запрос между ними
        // не дойдёт, он окажется заперт снаружи собственной админки.
        if (!выдать.isEmpty()) {
            http.post()
                    .uri(base + "/admin/realms/" + realm + "/users/" + userId
                            + "/role-mappings/realm")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(выдать)
                    .retrieve()
                    .toBodilessEntity();
        }

        if (!снять.isEmpty()) {
            http.method(HttpMethod.DELETE)
                    .uri(base + "/admin/realms/" + realm + "/users/" + userId
                            + "/role-mappings/realm")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(снять)
                    .retrieve()
                    .toBodilessEntity();
        }

        // Справочник кэшируется на TTL, и без сброса админка ещё две минуты
        // показывала бы прежние роли — то есть человек нажал бы кнопку
        // и не увидел результата.
        readAt = Instant.EPOCH;
    }

    private String userId(String token, String login) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> found = http.get()
                .uri(base + "/admin/realms/" + realm + "/users?exact=true&username=" + login)
                .header("Authorization", "Bearer " + token)
                .retrieve()
                .body(List.class);

        if (found == null || found.isEmpty()) {
            throw new Rejected("Такого логина нет в системе входа: " + login);
        }
        return text(found.get(0).get("id"));
    }

    /** Роли realm'а по имени: назначенные (suffix пустой) или доступные. */
    private Map<String, Map<String, Object>> realmRoles(String token, String userId,
                                                       String suffix) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> raw = http.get()
                .uri(base + "/admin/realms/" + realm + "/users/" + userId
                        + "/role-mappings/realm" + suffix)
                .header("Authorization", "Bearer " + token)
                .retrieve()
                .body(List.class);

        if (raw == null) return Map.of();

        Map<String, Map<String, Object>> byName = new HashMap<>();
        for (var role : raw) {
            var name = text(role.get("name"));
            if (!name.isBlank()) byName.put(name, role);
        }
        return byName;
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
                .map(raw -> person(raw, portalRolesOf(token, text(raw.get("id")))))
                .filter(p -> !p.login().isBlank())
                .sorted(Comparator.comparing(Person::label, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    // Роли — запросом на каждого человека.
    //
    // Сначала здесь стоял другой способ: спросить СОСТАВ каждой из трёх
    // ролей и получить всех разом — три запроса вместо сорока. Способ
    // хорош всем, кроме одного: дверь /roles/{роль}/users требует
    // view-realm, то есть права читать всю настройку realm'а. Портал его
    // не просит и просить не должен ради удобства чтения.
    //
    // Отказ при этом был бы ТИХИМ и не там, где ошибка: 403 прилетает
    // внутрь read(), а staff() ловит любое исключение и отдаёт прошлый
    // список — то есть пропали бы не роли, а сотрудники целиком, и
    // выглядело бы это как «Keycloak недоступен».
    //
    // Цена нынешнего способа — обращение на человека. Она меньше, чем
    // кажется: справочник кэшируется на TTL, и запросы идут раз в две
    // минуты, а не на каждую страницу. Станет дорого при сотнях учётных
    // записей — тогда и появится повод обсуждать view-realm.
    private List<String> portalRolesOf(String token, String userId) {
        if (userId.isBlank()) return List.of();

        var mine = realmRoles(token, userId, "").keySet();

        // Порядок — как в PORTAL_ROLES, а не как ответил Keycloak: список
        // показывается человеку, и «сегодня продажи первыми, завтра
        // содержимое» читается как изменение, которого не было.
        return PORTAL_ROLES.stream().filter(mine::contains).toList();
    }
    private static Person person(Map<String, Object> raw, List<String> roles) {
        var login = text(raw.get("username"));
        var first = text(raw.get("firstName"));
        var last = text(raw.get("lastName"));
        var name = (first + " " + last).trim();
        // enabled отсутствует у учётной записи, заведённой импортом realm'а
        // без явного поля: по смыслу Keycloak это «включена».
        var enabled = !Boolean.FALSE.equals(raw.get("enabled"));

        return new Person(login, name.isBlank() ? null : name, enabled, roles);
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
