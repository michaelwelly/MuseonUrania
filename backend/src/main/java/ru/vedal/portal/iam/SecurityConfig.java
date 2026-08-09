package ru.vedal.portal.iam;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    UserDetailsService userDetailsService(AdminUserRepository users) {
        return username -> users.findByUsername(username)
                .map(u -> User.withUsername(u.getUsername())
                        .password(u.getPasswordHash())
                        .disabled(!u.isEnabled())
                        .roles("ADMIN")
                        .build())
                .orElseThrow(() -> new UsernameNotFoundException(username));
    }

    // Публичное API и health открыты, всё под /admin — по сессии.
    // Отдельный маршрут выбран сознательно: его можно целиком закрыть
    // на уровне прокси, не трогая приложение.
    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/public/**", "/api/forms/**", "/api/assistant/**",
                                "/actuator/health", "/login").permitAll()
                        .requestMatchers("/admin/**").authenticated()
                        .anyRequest().denyAll())
                .formLogin(form -> form.defaultSuccessUrl("/admin/products", true))
                .logout(logout -> logout.logoutSuccessUrl("/login"))
                // Публичное API читающее, Forms API принимает JSON без cookie-сессии —
                // CSRF защищает от отправки формы из чужой вкладки под чужой сессией,
                // а здесь сессии нет. Периметр двери — валидация и лимит частоты.
                .csrf(csrf -> csrf.ignoringRequestMatchers("/api/public/**", "/api/forms/**",
                        "/api/assistant/**"))
                .build();
    }
}
