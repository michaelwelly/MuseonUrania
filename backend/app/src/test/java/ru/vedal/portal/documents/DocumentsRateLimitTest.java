package ru.vedal.portal.documents;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.vedal.portal.PostgresTestBase;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Двери документов (issue #65: разбор назвал их дверью без счётчика) теперь
// стоят под лимитом частоты — как формы и ассистент.
//
// Предел здесь понижен настройкой теста, а не проверяется настоящим
// (30 за 10 минут): дожидаться тридцати одного запроса ради теста накладно,
// а привязка к самому механизму RateLimit уже проверена RateLimitTest.
// Здесь проверяется другое — что дверь вообще спрашивает лимит и правильный
// (documentsRateLimit, а не чужой).
@AutoConfigureMockMvc
@TestPropertySource(properties = "vedal.documents.rate-limit.count=3")
class DocumentsRateLimitTest extends PostgresTestBase {

    @Autowired
    MockMvc mvc;

    @Test
    void listAndFileShareOneBudgetPerAddress() throws Exception {
        var адрес = свой();

        // Перечень и файл документа делят один бюджет: три обращения в любой
        // комбинации между обеими дверьми проходят...
        mvc.perform(get("/api/public/v1/documents").with(адрес)).andExpect(status().isOk());
        mvc.perform(get("/api/public/v1/documents/no-such-document/file").with(адрес))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/public/v1/documents").with(адрес)).andExpect(status().isOk());

        // ...а четвёртое, независимо от того, в какую из двух дверей,
        // упирается в общий потолок.
        mvc.perform(get("/api/public/v1/documents/no-such-document/file").with(адрес))
                .andExpect(status().isTooManyRequests());
    }

    /** Свой адрес клиента на тест — счётчик живёт в памяти процесса и не сбрасывается транзакцией. */
    private static RequestPostProcessor свой() {
        var адрес = "10." + (int) (Math.random() * 250)
                + "." + (int) (Math.random() * 250) + "." + (1 + (int) (Math.random() * 250));
        return request -> {
            request.setRemoteAddr(адрес);
            return request;
        };
    }
}
