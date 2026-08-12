package ru.vedal.portal.iam;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class AdminAccessTest extends PostgresTestBase {

    @Autowired
    MockMvc mvc;

    @Test
    void anonymousIsSentToLogin() throws Exception {
        mvc.perform(get("/admin/products")).andExpect(status().is3xxRedirection());
    }

    @Test
    void publicApiStaysOpen() throws Exception {
        mvc.perform(get("/api/public/v1/products")).andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "editor")
    void authenticatedUserSeesAdmin() throws Exception {
        mvc.perform(get("/admin/products")).andExpect(status().isOk());
    }
}
