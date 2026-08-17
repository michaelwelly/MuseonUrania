package ru.vedal.portal.common;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

// Нужно для OutboxRelay: без этого relay никогда не запустится, приложение
// останется зелёным, а события будут копиться в таблице.
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
