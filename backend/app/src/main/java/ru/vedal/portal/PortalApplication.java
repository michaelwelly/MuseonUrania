package ru.vedal.portal;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

// Сканирование @ConfigurationProperties по всему дереву модулей: настройки
// живут рядом со своим модулем, а не одним классом на приложение — иначе
// вынуть модуль в отдельный сервис значит сначала распутать общий конфиг.
@SpringBootApplication
@ConfigurationPropertiesScan
public class PortalApplication {

	public static void main(String[] args) {
		SpringApplication.run(PortalApplication.class, args);
	}

}
