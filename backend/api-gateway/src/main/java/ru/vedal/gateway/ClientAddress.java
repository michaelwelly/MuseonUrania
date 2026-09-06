package ru.vedal.gateway;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Кто на самом деле пришёл.
 *
 * <p><b>Зачем.</b> Портал знает о посетителе ровно один адрес — тот, с которого
 * к нему пришло соединение. За шлюзом это всегда адрес самого шлюза, и без
 * посредничества происходит вот что: журнал аудита пишет один и тот же
 * контейнерный адрес для всех и всего, а лимит частоты считает всех
 * посетителей мира одним клиентом — двадцать вопросов Ведалине за десять
 * минут на весь сайт, после чего чат отвечает «слишком часто» каждому.
 * Поймано на живом стенде: в журнале стояло `172.18.0.8` — адрес шлюза.
 *
 * <p><b>Почему это не решается настройкой.</b> Шлюз умеет проставлять
 * `X-Forwarded-For` сам, но с версии 5 делает это только для запросов,
 * пришедших от <i>доверенного</i> прокси (`trusted-proxies`), а всё
 * остальное — вырезает вместе с заголовком. Понятие «доверенный прокси»
 * там одно на две разные вещи: и «можно верить чужому заголовку»,
 * и «вообще заниматься этими заголовками». Нам нужна вторая без первой:
 * снаружи к шлюзу приходят прямо из интернета, и верить присланному
 * `X-Forwarded-For` нельзя ни на грамм — подставить туда чужой адрес
 * может кто угодно, а это и подложная запись в журнале, и обход лимита.
 *
 * <p><b>Что делает этот фильтр.</b> Отбирает у запроса право говорить
 * о себе: заголовки о происхождении вычищаются, и адрес проставляет
 * шлюз — по тому соединению, которое он видит своими глазами.
 *
 * <p>Исключение — {@code vedal.gateway.trusted-proxy}: когда перед шлюзом
 * стоит свой прокси (в проде это Caddy), заголовок приходит от него и
 * несёт настоящий адрес посетителя. Тогда он сохраняется — но только если
 * соединение пришло с адреса, который в этой настройке назван. Пусто —
 * не доверять никому, и это верное значение всюду, где шлюз смотрит
 * в интернет сам.
 */
@Component
public class ClientAddress implements GlobalFilter, Ordered {

    /**
     * Всё, чем запрос может рассказать о своём происхождении.
     *
     * <p>Вычищается разом: оставить один из них значит оставить лазейку —
     * порталу довольно любого, и какой именно он прочтёт, зависит
     * от настроек, а не от нашего решения.
     */
    private static final List<String> ORIGIN_CLAIMS =
            List.of("Forwarded", "X-Forwarded-For", "X-Forwarded-Host",
                    "X-Forwarded-Proto", "X-Forwarded-Port", "X-Real-IP");

    private final Pattern trustedProxy;

    public ClientAddress(@Value("${vedal.gateway.trusted-proxy:}") String trustedProxy) {
        this.trustedProxy = trustedProxy.isBlank() ? null : Pattern.compile(trustedProxy);
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        if (fromTrustedProxy(exchange)) return chain.filter(exchange);

        var request = exchange.getRequest().mutate()
                .headers(headers -> ORIGIN_CLAIMS.forEach(headers::remove))
                .build();
        return chain.filter(exchange.mutate().request(request).build());
    }

    private boolean fromTrustedProxy(ServerWebExchange exchange) {
        if (trustedProxy == null) return false;

        var remote = exchange.getRequest().getRemoteAddress();
        if (remote == null || remote.getAddress() == null) return false;

        return trustedProxy.matcher(remote.getAddress().getHostAddress()).matches();
    }

    /**
     * Раньше всех остальных: заголовки должны быть вычищены до того,
     * как их прочтёт хоть один фильтр маршрута.
     */
    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }
}
