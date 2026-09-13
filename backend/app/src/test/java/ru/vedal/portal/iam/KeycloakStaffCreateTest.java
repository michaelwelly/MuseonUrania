package ru.vedal.portal.iam;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.List;

import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class KeycloakStaffCreateTest {

    @Test
    void createsTemporaryAccountAndAssignsOnlyRequestedPortalRoles() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var directory = new KeycloakStaffDirectory(
                builder, "http://keycloak", "vedal", "portal-svc", "secret");

        token(server);
        server.expect(once(), requestTo("http://keycloak/admin/realms/vedal/users"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().json("""
                        {
                          "username": "lucky",
                          "firstName": "Лаки Ромаган Голо",
                          "enabled": true,
                          "credentials": [{
                            "type": "password",
                            "value": "Temporary!2026",
                            "temporary": true
                          }]
                        }
                        """))
                .andRespond(withSuccess());

        token(server);
        server.expect(requestTo(
                        "http://keycloak/admin/realms/vedal/users?exact=true&username=lucky"))
                .andRespond(withSuccess("[{\"id\":\"u1\"}]", MediaType.APPLICATION_JSON));
        server.expect(requestTo(
                        "http://keycloak/admin/realms/vedal/users/u1/role-mappings/realm"))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
        server.expect(requestTo(
                        "http://keycloak/admin/realms/vedal/users/u1/role-mappings/realm/available"))
                .andRespond(withSuccess(
                        "[{\"id\":\"r1\",\"name\":\"portal-sales\"}]",
                        MediaType.APPLICATION_JSON));
        server.expect(requestTo(
                        "http://keycloak/admin/realms/vedal/users/u1/role-mappings/realm"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().json("[{\"id\":\"r1\",\"name\":\"portal-sales\"}]"))
                .andRespond(withSuccess());

        directory.create("lucky", "Лаки Ромаган Голо", "Temporary!2026",
                List.of("portal-sales"));

        server.verify();
    }

    private static void token(MockRestServiceServer server) {
        server.expect(requestTo(
                        "http://keycloak/realms/vedal/protocol/openid-connect/token"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("{\"access_token\":\"token\"}",
                        MediaType.APPLICATION_JSON));
    }
}
