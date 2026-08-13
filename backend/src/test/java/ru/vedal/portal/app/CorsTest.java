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
@TestPropertySource(properties = "vedal.web.allowed-origins=https://vedal-med.ru")
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

    // Админка на сессии: кросс-доменный доступ к ней не открывается никому,
    // включая собственный сайт.
    @Test
    void adminIsNotReachableCrossOrigin() throws Exception {
        mvc.perform(options("/admin/products")
                        .header("Origin", "https://vedal-med.ru")
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
