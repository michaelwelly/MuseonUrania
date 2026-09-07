package ru.vedal.gateway;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.InetSocketAddress;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Право запроса рассказывать о своём происхождении.
 *
 * <p>Проверяется не «фильтр работает», а последствие: подставленный
 * посетителем адрес не должен доехать до портала, потому что там он
 * становится записью в журнале аудита и ключом лимита частоты. Заголовок,
 * пришедший из интернета, — это заявление, а не факт.
 */
class ClientAddressTest {

    /** Запоминает, с чем запрос ушёл дальше по цепочке. */
    private static HttpHeaders forwarded(ClientAddress filter, ServerWebExchange exchange) {
        var seen = new HttpHeaders[1];
        filter.filter(exchange, next -> {
            seen[0] = next.getRequest().getHeaders();
            return Mono.empty();
        }).block();
        return seen[0];
    }

    private static MockServerWebExchange arriving(String from, HttpHeaders claims) {
        var request = MockServerHttpRequest.get("/api/public/v1/products")
                .remoteAddress(new InetSocketAddress(from, 51000))
                .headers(claims)
                .build();
        return MockServerWebExchange.from(request);
    }

    private static HttpHeaders claiming(String address) {
        var headers = new HttpHeaders();
        headers.set("X-Forwarded-For", address);
        headers.set("X-Real-IP", address);
        headers.set("Forwarded", "for=" + address);
        return headers;
    }

    // Главное правило. Снаружи к шлюзу приходят прямо из интернета, и
    // «я пришёл с 8.8.8.8» — это то, что клиент напечатал сам.
    @Test
    void aVisitorCannotNameHisOwnAddress() {
        var headers = forwarded(new ClientAddress(""), arriving("203.0.113.9", claiming("8.8.8.8")));

        assertThat(headers.headerNames())
                .as("Всё, чем запрос говорит о своём происхождении, отбирается разом: "
                        + "оставленного заголовка порталу довольно")
                .doesNotContain("X-Forwarded-For", "X-Real-IP", "Forwarded");
    }

    // В проде перед шлюзом стоит Caddy, и его заголовок — единственный
    // источник настоящего адреса посетителя.
    @Test
    void theProxyInFrontIsBelievedWhenItIsTheOneNamed() {
        var filter = new ClientAddress("172\\.20\\.0\\.5");
        var headers = forwarded(filter, arriving("172.20.0.5", claiming("203.0.113.9")));

        assertThat(headers.getFirst("X-Forwarded-For")).isEqualTo("203.0.113.9");
    }

    // Доверие адресное, а не «раз настройка задана — верим всем». Иначе
    // достаточно прийти мимо прокси, чтобы снова назваться кем угодно.
    @Test
    void thatTrustDoesNotExtendToAnyoneElse() {
        var filter = new ClientAddress("172\\.20\\.0\\.5");
        var headers = forwarded(filter, arriving("203.0.113.9", claiming("8.8.8.8")));

        assertThat(headers.headerNames()).doesNotContain("X-Forwarded-For");
    }

    // Запрос без адреса соединения — не повод довериться заголовку.
    @Test
    void anUnknownSenderIsNotTrustedEither() {
        var filter = new ClientAddress("172\\.20\\.0\\.5");
        var request = MockServerHttpRequest.get("/api/public/v1/products")
                .headers(claiming("8.8.8.8"))
                .build();

        var headers = forwarded(filter, MockServerWebExchange.from(request));

        assertThat(headers.headerNames()).doesNotContain("X-Forwarded-For");
    }
}
