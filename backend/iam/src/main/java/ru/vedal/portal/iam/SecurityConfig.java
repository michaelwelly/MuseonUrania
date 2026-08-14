package ru.vedal.portal.iam;

import jakarta.servlet.DispatcherType;
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

    // Учётные записи в базе нужны только запасному режиму vedal.iam.mode=local:
    // это разработка и случай, когда провайдера идентичности ещё нет.
    // В режиме keycloak пароли живут там, и этот бин не используется.
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

    // Всё, кроме дверей правки. Сессии здесь нет: после переезда админки
    // на отдельное приложение у портала не осталось ни одной страницы,
    // которую открывают браузером под учётной записью, — а значит, нет ни
    // cookie, ни формы входа, ни CSRF-токена, который надо было бы защищать.
    // Это убрало целый класс рисков разом, а не сократило код.
    //
    // Цепочка вторая по порядку: первая, из AdminApiSecurityConfig, забирает
    // /api/admin/** — там токен.
    @Bean
    @Order(Ordered.LOWEST_PRECEDENCE - 10)
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                // Правила берутся из CorsConfigurationSource — он описан
                // в app и покрывает публичные двери и дверь админки. Без этой
                // строки Spring Security отвечает на preflight раньше, чем
                // до него доходит очередь, и браузер видит отказ вместо
                // заголовков.
                .cors(Customizer.withDefaults())
                .authorizeHttpRequests(auth -> auth
                        // Разбор ошибки идёт отдельной диспетчеризацией на /error,
                        // и без этого правила она упирается в denyAll. Публичная
                        // дверь на битый JSON отвечала бы отказом в доступе
                        // вместо 400, и сайт показывал бы посетителю не то.
                        //
                        // Разрешена именно диспетчеризация, а не путь: прямой
                        // запрос на /error остаётся закрытым.
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers("/api/public/**", "/api/forms/**", "/api/assistant/**")
                        .permitAll()
                        // Живость и готовность. Пробы разнесены: контейнер,
                        // не прошедший readiness, снимается с балансировки,
                        // но не перезапускается — а не прошедший liveness
                        // перезапускается. Слить их значит перезапускать
                        // приложение из-за недоступной на секунду базы.
                        .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
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
                        .anyRequest().denyAll())
                // Сессия не создаётся вовсе: у портала не осталось ни одной
                // двери, которая опознавала бы запрос по cookie.
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // Нет сессии — нет ambient authority: чужая вкладка не может
                // отправить запрос «под пользователем», и защищать CSRF-токеном
                // нечего. Периметр публичных дверей — валидация, ловушка
                // для ботов и лимит частоты.
                .csrf(csrf -> csrf.disable())
                .build();
    }

    // Общая часть двери админского API: она одинакова и с Keycloak,
    // и с локальными учётками, и разъезжаться этим двум режимам нельзя.
    static HttpSecurity adminApiBaseline(HttpSecurity http) throws Exception {
        return http
                .securityMatcher("/api/admin/**")
                .cors(Customizer.withDefaults())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .anyRequest().hasAnyRole(ROLE_ADMIN, ROLE_EDITOR));
    }
}
