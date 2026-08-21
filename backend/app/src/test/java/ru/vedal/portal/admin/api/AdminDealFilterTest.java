package ru.vedal.portal.admin.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import ru.vedal.portal.PostgresTestBase;
import ru.vedal.portal.crm.ClientAdmin;
import ru.vedal.portal.crm.DealAdmin;

import java.math.BigDecimal;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Отбор списка сделок.
//
// Появился ради карточки сотрудника: «сколько сделок на человеке» — вопрос,
// на который до сих пор было нечем ответить, и на месте числа стоял прочерк.
// Но выяснилось, что чинить надо не только это.
//
// Второе, ради чего написан класс. Признаки отбора обязаны складываться,
// а не перекрывать друг друга. До этой правки `clientId` отменял воронку,
// и админка это обходила: при выбранном клиенте посылала воронку пустой.
// На экране поэтому ничего не врало — подпорка стояла снаружи двери,
// и держалась она на том, что вызывающий помнит про особенность. Тест
// на отдельный признак такого не ловит: каждый из них поодиночке работает.
@AutoConfigureMockMvc
class AdminDealFilterTest extends PostgresTestBase {

    @Autowired
    MockMvc mvc;

    @Autowired
    ClientAdmin clients;

    @Autowired
    DealAdmin deals;

    private UUID гкб;

    @BeforeEach
    void seed() {
        гкб = client("ГКБ №1");
        var клиника = client("Клиника Здоровье");

        // У одного клиента две сделки в разных воронках — на этом и ловится
        // перекрытие признаков.
        deal(гкб, "sales", "Поставка двух систем VEDAL R2", "irina");
        deal(гкб, "service", "Плановое обслуживание R1", null);
        deal(клиника, "sales", "Запрос на VEDAL A-2000", "irina");
        deal(клиника, "dealer", "Дилерское соглашение", "sergey");
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void ownerFilterTellsMineFromNobodys() throws Exception {
        list("owner=irina").andExpect(jsonPath("$.total").value(2));

        // «-» — вопрос «что никто не ведёт», а не отсутствие фильтра.
        list("owner=-").andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].owner").doesNotExist());

        list("owner=никто-такой").andExpect(jsonPath("$.total").value(0));
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void clientAndPipelineNarrowTogetherInsteadOfOverriding() throws Exception {
        // У клиента две сделки, но в воронке продаж — одна. До правки этот
        // запрос отдавал обе: `clientId` отменял воронку.
        list("clientId=" + гкб).andExpect(jsonPath("$.total").value(2));
        list("clientId=" + гкб + "&pipeline=sales").andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].pipeline").value("sales"));
        list("clientId=" + гкб + "&pipeline=dealer").andExpect(jsonPath("$.total").value(0));
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void everyFilterAddsUpToTheOthers() throws Exception {
        list("pipeline=sales").andExpect(jsonPath("$.total").value(2));
        list("pipeline=sales&owner=irina").andExpect(jsonPath("$.total").value(2));
        list("pipeline=dealer&owner=irina").andExpect(jsonPath("$.total").value(0));
        list("pipeline=sales&stage=new&owner=sergey").andExpect(jsonPath("$.total").value(0));
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void stageStillHasToBelongToItsPipeline() throws Exception {
        // Проверка воронки не должна пропасть вместе с ветвлением: стадия
        // из чужой воронки — это опечатка в адресе, и молчаливый пустой
        // список читается как «сделок нет», а не «спрошено бессмысленное».
        mvc.perform(get("/api/admin/v1/deals?pipeline=sales&stage=diagnostics"))
                .andExpect(status().isConflict());
    }

    @Test
    @WithMockUser(username = "manager", roles = "PORTAL_ADMIN")
    void pagingCountsTheWholeSelectionNotTheScreen() throws Exception {
        list("owner=irina&size=1")
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.pages").value(2));
    }

    private ResultActions list(String query) throws Exception {
        return mvc.perform(get("/api/admin/v1/deals?" + query)).andExpect(status().isOk());
    }

    private UUID client(String name) {
        return clients.create(new ClientAdmin.ClientForm(null, name, "company", null, null,
                null, null, null, null, null, null, null), "seed").id();
    }

    private void deal(UUID clientId, String pipeline, String title, String owner) {
        deals.create(new DealAdmin.NewDeal(clientId, pipeline, title,
                new BigDecimal("1000000.00"), "RUB", null, owner), "seed");
    }
}
