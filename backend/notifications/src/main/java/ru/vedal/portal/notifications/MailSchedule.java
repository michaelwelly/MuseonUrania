package ru.vedal.portal.notifications;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class MailSchedule {

    private final MailDispatch dispatch;

    public MailSchedule(MailDispatch dispatch) {
        this.dispatch = dispatch;
    }

    @Scheduled(fixedDelayString = "${vedal.notifications.dispatch.delay:PT5S}")
    public void tick() {
        dispatch.drain();
        dispatch.measure();
    }
}
