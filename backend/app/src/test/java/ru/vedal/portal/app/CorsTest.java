package ru.vedal.portal.app;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "vedal.web.allowed-origins=https://vedal-med.ru",
        // Адрес админки задаётся отдельно от адреса сайта: это разные
        // периметры, и открывать дверь правки всему, чему открыт публичный
        // сайт, незачем.
        "vedal.web.admin-origins=https://admin.vedal-med.ru"})
class CorsTest extends PostgresTestBase {

    @Autowired
    MockMvc mvc;

    @Test
    void siteMaySubmitForms() throws Exception {
        mvc.perform(options("/api/forms/v1/leads")
                        .header("Origin", "https://vedal-med.ru")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "Content-Type, Idempotency-Key"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://vedal-med.ru"));
    }

    @Test
    void siteMayAskAssistant() throws Exception {
        mvc.perform(options("/api/assistant/v1/ask")
                        .header("Origin", "https://vedal-med.ru")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://vedal-med.ru"));
    }

    // Смысл списка источников в том, что он что-то отсекает. Тест на разрешённый
    // источник в одиночку зелёный и при `allowedOrigins("*")`.
    @Test
    void foreignSiteMayNot() throws Exception {
        mvc.perform(options("/api/forms/v1/leads")
                        .header("Origin", "https://evil.example")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    // Дверь правки открыта кросс-доменно, и это не послабление: она опознаёт
    // запрос по заголовку Authorization, а не по cookie. Чужая вкладка такой
    // заголовок проставить не может, поэтому разрешение приходить с адреса
    // админки не даёт ей ничего.
    @Test
    void adminApiIsReachableFromTheAdminOrigin() throws Exception {
        mvc.perform(options("/api/admin/v1/products")
                        .header("Origin", "https://admin.vedal-med.ru")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(header().string("Access-Control-Allow-Origin", "https://admin.vedal-med.ru"))
                // Учётные данные не передаются: браузер не должен приложить
                // сюда ни cookie, ни basic-заголовок сам по себе.
                .andExpect(header().doesNotExist("Access-Control-Allow-Credentials"));
    }

    // Два списка источников — не удвоение настройки, а разные периметры.
    // Сайт открыт всему миру, админка — нет, и адрес сайта не должен давать
    // доступа к двери правки.
    @Test
    void theSiteOriginDoesNotOpenTheAdminDoor() throws Exception {
        mvc.perform(options("/api/admin/v1/products")
                        .header("Origin", "https://vedal-med.ru")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    void adminApiIsNotReachableFromAnUnknownOrigin() throws Exception {
        mvc.perform(options("/api/admin/v1/products")
                        .header("Origin", "https://evil.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    // Учётные данные не передаются: у публичных дверей нет ни cookie, ни сессии.
    @Test
    void credentialsAreNotAllowed() throws Exception {
        mvc.perform(options("/api/public/v1/products")
                        .header("Origin", "https://vedal-med.ru")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("Access-Control-Allow-Credentials"));
    }
}
