package ru.vedal.portal.iam;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.UUID;

// Пароль приходит из окружения и в репозиторий не попадает.
// Если переменные не заданы, учётная запись не создаётся — падать не нужно,
// но и молча заводить известный всем пароль тоже.
@Configuration
public class AdminUserSeeder {

    @Bean
    ApplicationRunner createFirstAdmin(AdminUserRepository users,
                                       PasswordEncoder encoder,
                                       @Value("${vedal.admin.username:}") String username,
                                       @Value("${vedal.admin.password:}") String password) {
        return args -> {
            if (username.isBlank() || password.isBlank()) return;
            if (users.findByUsername(username).isPresent()) return;

            var user = new AdminUser();
            user.setId(UUID.randomUUID());
            user.setUsername(username);
            user.setPasswordHash(encoder.encode(password));
            user.setDisplayName(username);
            users.save(user);
        };
    }
}
