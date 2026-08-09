package ru.vedal.portal.gateway;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class GatewayMaintenance {

    private final RateLimit rateLimit;

    public GatewayMaintenance(RateLimit rateLimit) {
        this.rateLimit = rateLimit;
    }

    @Scheduled(fixedDelayString = "${vedal.forms.rate-limit.cleanup:PT5M}")
    public void forgetOldClients() {
        rateLimit.forget();
    }
}
