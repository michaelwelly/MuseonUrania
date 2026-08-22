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

    // Роли портала. Их три, и делят они не действия, а контуры.
    //
    // Раньше их было две — portal-admin и portal-editor, — и давали они
    // одно и то же: одно правило hasAnyRole пускало обе ко всему админскому
    // API. Это было записано честно («разделение появится вместе с CRM»),
    // но CRM появилась, и вместе с ней клиентская база, суммы сделок
    // и переписка с посетителями. Раздавать их тому, кто пришёл править
    // карточку изделия, больше нельзя: бриф собственника прямо относит
    // клиентскую базу и коммерческие условия к тому, что наружу не выносим,
    // а «наружу» начинается с лишнего человека внутри.
    //
    // Деление по контурам, а не по глаголам (читатель/редактор). Причина
    // простая: у сотрудника отдела продаж и у того, кто ведёт сайт, разные
    // ПРЕДМЕТЫ работы, а не разная глубина доступа к одному предмету.
    // Право «читать, но не править» сделку — иерархия, которой никто
    // не просил; право «не видеть сделку вовсе» — то, о чём просили.
    static final String ROLE_ADMIN = "PORTAL_ADMIN";

    /** Закрытый контур продаж: заявки, клиенты, сделки, КП, разговоры, аналитика. */
    static final String ROLE_SALES = "PORTAL_SALES";

    /** Содержимое сайта: продукция, категории, новости, документы, снимки. */
    static final String ROLE_PRODUCTION = "PORTAL_PRODUCTION";

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
                        // Те же роли, что раздаёт Keycloak. Иначе запасной
                        // профиль проверяет не то правило, что боевой,
                        // и расхождение вылезает при переключении.
                        //
                        // Учётка запасного режима получает все три: он нужен
                        // разработке и случаю «провайдера идентичности ещё нет»,
                        // и разделять контуры там, где пользователь один,
                        // значит мешать работать без единой выгоды.
                        .roles(ROLE_ADMIN, ROLE_SALES, ROLE_PRODUCTION)
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
    //
    // ————— почему правила здесь, а не на методах —————
    //
    // @PreAuthorize над каждым методом читается легче в отдельно взятом
    // контроллере и хуже — целиком: чтобы ответить «кто видит клиентскую
    // базу», пришлось бы обойти шестнадцать файлов и надеяться, что нигде
    // не забыли. Здесь ответ помещается на экран, а забытая дверь
    // проваливается в denyAll, а не в «пускаем всех вошедших».
    static HttpSecurity adminApiBaseline(HttpSecurity http) throws Exception {
        return http
                .securityMatcher("/api/admin/**")
                .cors(Customizer.withDefaults())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()

                        // Уничтожение персональных данных — раньше всех
                        // остальных правил, иначе его накроет правило контура:
                        // DELETE /leads/{id}/personal-data лежит под /leads/**,
                        // и продажи получили бы кнопку, отменить нажатие
                        // которой нельзя ничем.
                        .requestMatchers("/api/admin/v1/*/*/personal-data")
                        .hasRole(ROLE_ADMIN)

                        // Кто вошёл и что ему можно. Спрашивает оболочка
                        // на каждой странице, и роль здесь любая портальная:
                        // закрыв дверь одной, мы закрыли бы вход тому,
                        // у кого роль есть, но другая.
                        //
                        // Именно портальная, а не «любой вошедший». Сначала
                        // здесь стояло authenticated(), и это уронило
                        // AdminAccessTest: он обходит ВСЕ админские маршруты
                        // и требует 403 от чужой роли. Сторож прав — токен
                        // соседнего клиента realm'а не должен получать
                        // от админской двери ничего, даже собственное имя.
                        .requestMatchers("/api/admin/v1/session")
                        .hasAnyRole(ROLE_ADMIN, ROLE_SALES, ROLE_PRODUCTION)

                        // Ведалина для сотрудника. Ищет по опубликованному
                        // плюс внутренние документы — это рабочий инструмент
                        // обоих контуров, а не привилегия одного.
                        .requestMatchers("/api/admin/v1/assistant/**")
                        .hasAnyRole(ROLE_ADMIN, ROLE_SALES, ROLE_PRODUCTION)

                        // ————— закрытый контур продаж —————
                        //
                        // Клиентская база, суммы сделок и переписка
                        // с посетителями. Тот, кто ведёт сайт, здесь
                        // не бывает вовсе.
                        .requestMatchers("/api/admin/v1/leads/**", "/api/admin/v1/leads",
                                "/api/admin/v1/clients/**", "/api/admin/v1/clients",
                                "/api/admin/v1/deals/**", "/api/admin/v1/deals",
                                "/api/admin/v1/quotes/**", "/api/admin/v1/quotes",
                                "/api/admin/v1/chats/**", "/api/admin/v1/chats",
                                "/api/admin/v1/analytics/**", "/api/admin/v1/analytics")
                        .hasAnyRole(ROLE_SALES, ROLE_ADMIN)

                        // ————— содержимое сайта —————
                        //
                        // То, что уходит наружу: каталог, лента, перечень
                        // документов и снимки. Персональных данных здесь нет
                        // ни в одной двери.
                        .requestMatchers("/api/admin/v1/products/**", "/api/admin/v1/products",
                                "/api/admin/v1/categories/**", "/api/admin/v1/categories",
                                "/api/admin/v1/news/**", "/api/admin/v1/news",
                                "/api/admin/v1/documents/**", "/api/admin/v1/documents",
                                "/api/admin/v1/media/**", "/api/admin/v1/media")
                        .hasAnyRole(ROLE_PRODUCTION, ROLE_ADMIN)

                        // ————— только администратор —————
                        //
                        // Журнал показывает, кто что делал, — включая тех,
                        // кто смотрит. Справочник сотрудников показывает
                        // состав компании. Ни то, ни другое не нужно
                        // для работы ни одного из контуров.
                        .requestMatchers("/api/admin/v1/audit/**", "/api/admin/v1/audit",
                                "/api/admin/v1/staff/**", "/api/admin/v1/staff")
                        .hasRole(ROLE_ADMIN)

                        // Новая дверь, о которой забыли здесь, закрыта
                        // для всех, а не открыта для всех вошедших.
                        // Забытое правило обязано ломать работу заметно,
                        // а не раздавать доступ молча.
                        .anyRequest().denyAll());
    }
}
