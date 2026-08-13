package ru.vedal.portal.gateway;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Что происходит, когда до контроллера дело не дошло.
//
// Разбор тела идёт до обработчиков, и его отказ уезжает отдельной
// диспетчеризацией на /error. Пока /error был закрыт общим denyAll, публичная
// дверь отвечала на битый JSON редиректом на форму входа: сайт показывал
// посетителю страницу входа в админку, а разработчик искал причину в CORS.
@AutoConfigureMockMvc
class MalformedRequestTest extends PostgresTestBase {

    @Autowired
    MockMvc mvc;

    @Test
    void brokenJsonGetsAnErrorAndNotTheLoginForm() throws Exception {
        mvc.perform(post("/api/forms/v1/leads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"form\":\"quote\", это не json}"))
                .andExpect(status().isBadRequest());
    }

    // Тот же путь: разбор тела падает раньше валидации, потому что consent —
    // примитив, а не Boolean.
    @Test
    void nullInPrimitiveFieldGetsAnErrorAndNotTheLoginForm() throws Exception {
        mvc.perform(post("/api/forms/v1/leads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"form":"quote","name":"Пётр","phone":"+7 343 555-22-11",
                                 "email":"p@example.ru","message":"Достаточно длинный текст.",
                                 "consent":null}
                                """))
                .andExpect(status().isBadRequest());
    }

    // Дверь есть, метод не тот. Ответ обязан быть 405, а не приглашением войти.
    @Test
    void wrongMethodGetsMethodNotAllowed() throws Exception {
        mvc.perform(post("/api/public/v1/products"))
                .andExpect(status().isMethodNotAllowed());
    }
}
