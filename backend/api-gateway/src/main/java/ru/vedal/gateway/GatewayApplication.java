package ru.vedal.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

// Единая точка входа контура. Из брифа собственника это DMZ / Integration
// Gateway: снаружи виден один адрес, за ним — портал и сайт.
//
// Что он даёт, кроме маршрутизации:
//
//   - сайт и API оказываются на одном источнике, и CORS перестаёт быть
//     частью периметра вообще: браузер не делает кросс-доменный запрос,
//     когда домен один;
//   - лимит тела и проверка токена стоят в одном месте, а не в каждом
//     приложении за ним;
//   - настоящий адрес клиента доезжает до портала одним и тем же способом
//     независимо от того, что стоит перед шлюзом.
//
// Чего он НЕ даёт: доверия. Портал проверяет токен сам и отказывает запросу,
// пришедшему мимо шлюза. Шлюз — фильтр, а не граница доверия.
@SpringBootApplication
public class GatewayApplication {

	public static void main(String[] args) {
		SpringApplication.run(GatewayApplication.class, args);
	}

}
