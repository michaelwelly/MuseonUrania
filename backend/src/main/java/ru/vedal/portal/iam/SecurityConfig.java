package ru.vedal.portal.iam;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    // Роли портала. Их две, и обе значат право править содержимое: разделение
    // на «кто читает» и «кто правит» появится вместе с CRM, где право видеть
    // сделку и право её менять — разные вещи. Заводить его сейчас значит
    // выдумать иерархию, которой никто не пользуется.
    static final String ROLE_ADMIN = "PORTAL_ADMIN";
    static final String ROLE_EDITOR = "PORTAL_EDITOR";

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
                        // Та же роль, что раздаёт Keycloak. Иначе запасной
                        // профиль проверяет не то правило, что боевой,
                        // и расхождение вылезает при переключении.
                        .roles(ROLE_ADMIN)
                        .build())
                .orElseThrow(() -> new UsernameNotFoundException(username));
    }

    // Публичное API и health открыты, всё под /admin — по сессии.
    // Отдельный маршрут выбран сознательно: его можно целиком закрыть
    // на уровне прокси, не трогая приложение.
    //
    // Цепочка вторая по порядку: первая, из AdminApiSecurityConfig, забирает
    // /api/admin/** — там ни сессии, ни формы входа, там токен.
    @Bean
    @Order(Ordered.LOWEST_PRECEDENCE - 10)
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                // Правила берутся из CorsConfigurationSource — он описан
                // в app и покрывает только публичные двери. Без этой строки
                // Spring Security отвечает на preflight раньше, чем до него
                // доходит очередь, и браузер видит отказ вместо заголовков.
                .cors(Customizer.withDefaults())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/public/**", "/api/forms/**", "/api/assistant/**",
                                "/actuator/health", "/login").permitAll()
                        // Спецификация и Swagger UI. Открыты не потому, что их
                        // не жалко: там, где лежат настоящие данные, springdoc
                        // выключен профилем — обработчика на этих адресах нет,
                        // и запрос до спецификации не доходит. Закрывать их ещё
                        // и входом значит требовать учётную запись портала
                        // от того, кто по спецификации только интегрируется.
                        // Спецификация отдаётся и в YAML, и это отдельный
                        // сегмент пути: под /v3/api-docs/** он не подходит.
                        .requestMatchers("/v3/api-docs/**", "/v3/api-docs.yaml/**",
                                "/swagger-ui/**", "/swagger-ui.html")
                        .permitAll()
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

    // Общая часть двери админского API: она одинакова и с Keycloak,
    // и с локальными учётками, и разъезжаться этим двум режимам нельзя.
    static HttpSecurity adminApiBaseline(HttpSecurity http) throws Exception {
        return http
                .securityMatcher("/api/admin/**")
                .cors(Customizer.withDefaults())
                // Сессии нет: дверь опознаёт запрос по заголовку Authorization.
                // Значит, нет и ambient authority — чужая вкладка не может
                // отправить сюда запрос «под пользователем», и CSRF-токен
                // защищать нечего.
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth
                        .anyRequest().hasAnyRole(ROLE_ADMIN, ROLE_EDITOR));
    }
}
