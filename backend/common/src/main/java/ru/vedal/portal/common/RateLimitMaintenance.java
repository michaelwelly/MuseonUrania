package ru.vedal.portal.common;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

// Чистит счётчики всех дверей: экземпляров RateLimit столько, сколько публичных
// входов, и каждый копит по ключу на уникальный адрес.
@Component
public class RateLimitMaintenance {

    private final List<RateLimit> limits;

    public RateLimitMaintenance(List<RateLimit> limits) {
        this.limits = limits;
    }

    @Scheduled(fixedDelayString = "${vedal.rate-limit.cleanup:PT5M}")
    public void forgetOldClients() {
        limits.forEach(RateLimit::forget);
    }
}
