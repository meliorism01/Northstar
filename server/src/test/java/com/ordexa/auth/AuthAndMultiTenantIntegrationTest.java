package com.ordexa.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ordexa.auth.security.AuthRateLimitFilter;
import com.ordexa.user.entity.User;
import com.ordexa.user.entity.UserStatus;
import com.ordexa.user.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthAndMultiTenantIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AuthRateLimitFilter authRateLimitFilter;

    @BeforeEach
    void resetRateLimiters() {
        authRateLimitFilter.resetCounters();
    }

    @Test
    void registrationLoginRefreshRotationReplayDetectionAndLogoutLifecycle() throws Exception {
        String email = "rahul." + UUID.randomUUID().toString().substring(0, 6) + "@abcfashion.in";

        // 1. Register Merchant A
        MvcResult regResult = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "businessName", "ABC Fashion",
                                "ownerName", "Rahul Sharma",
                                "email", email,
                                "password", "StrongPassword123!"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.user.email").value(email))
                .andExpect(jsonPath("$.data.workspace.businessName").value("ABC Fashion"))
                .andExpect(jsonPath("$.data.workspace.role").value("OWNER"))
                .andReturn();

        // Verify password hash in DB is BCrypt and never plaintext
        User savedUser = userRepository.findByEmailIgnoreCase(email).orElseThrow();
        assertThat(savedUser.getPasswordHash()).startsWith("$2a$").doesNotContain("StrongPassword123!");

        // 2. Duplicate registration is rejected with 409 CONFLICT
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "businessName", "Duplicate Store",
                                "ownerName", "Rahul Sharma",
                                "email", email.toUpperCase(),
                                "password", "StrongPassword123!"
                        ))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("DUPLICATE_ACCOUNT"));

        // 3. Invalid password login is rejected with 401
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", email,
                                "password", "WrongPassword999!"
                        ))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value("INVALID_CREDENTIALS"));

        // 4. Valid login returns JWT access token and HttpOnly refresh cookie
        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", email,
                                "password", "StrongPassword123!"
                        ))))
                .andExpect(status().isOk())
                .andExpect(cookie().exists("ordexa_refresh_token"))
                .andExpect(cookie().httpOnly("ordexa_refresh_token", true))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.activeWorkspace.businessName").value("ABC Fashion"))
                .andReturn();

        Cookie refreshCookie1 = loginResult.getResponse().getCookie("ordexa_refresh_token");
        assertThat(refreshCookie1).isNotNull();

        // 5. Rotate refresh token
        MvcResult refreshResult = mockMvc.perform(post("/api/v1/auth/refresh")
                        .cookie(refreshCookie1))
                .andExpect(status().isOk())
                .andExpect(cookie().exists("ordexa_refresh_token"))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andReturn();

        Cookie refreshCookie2 = refreshResult.getResponse().getCookie("ordexa_refresh_token");
        assertThat(refreshCookie2).isNotNull();
        assertThat(refreshCookie2.getValue()).isNotEqualTo(refreshCookie1.getValue());

        // 6. Replay detection: Re-using refreshCookie1 revokes the entire session!
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .cookie(refreshCookie1))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value("REFRESH_TOKEN_REPLAY"));

        // Verify refreshCookie2 is also now invalid because the session was revoked
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .cookie(refreshCookie2))
                .andExpect(status().isUnauthorized());

        // 7. Re-login and test explicit logout revoking immediate access token usage
        MvcResult loginResult2 = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", email,
                                "password", "StrongPassword123!"
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode loginJson2 = objectMapper.readTree(loginResult2.getResponse().getContentAsString());
        String accessToken2 = loginJson2.at("/data/accessToken").asText();
        Cookie cookieAfterLogin2 = loginResult2.getResponse().getCookie("ordexa_refresh_token");

        mockMvc.perform(get("/api/v1/users/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value(email));

        mockMvc.perform(post("/api/v1/auth/logout")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken2)
                        .cookie(cookieAfterLogin2))
                .andExpect(status().isOk());

        // Immediately after logout, even the unexpired JWT is rejected because session status is REVOKED
        mockMvc.perform(get("/api/v1/users/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken2))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void inactiveUserAccountCannotAuthenticate() throws Exception {
        String email = "inactive." + UUID.randomUUID().toString().substring(0, 6) + "@example.com";
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "businessName", "Dormant Brand",
                                "ownerName", "Dormant User",
                                "email", email,
                                "password", "StrongPassword123!"
                        ))))
                .andExpect(status().isCreated());

        User user = userRepository.findByEmailIgnoreCase(email).orElseThrow();
        user.setStatus(UserStatus.INACTIVE);
        userRepository.save(user);

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", email,
                                "password", "StrongPassword123!"
                        ))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("ACCOUNT_INACTIVE"));
    }

    @Test
    void crossTenantIsolationBlocksUnauthorizedWorkspaceSelectionAndResourceAccess() throws Exception {
        String emailA = "owner.a." + UUID.randomUUID().toString().substring(0, 6) + "@merchanta.in";
        String emailB = "owner.b." + UUID.randomUUID().toString().substring(0, 6) + "@merchantb.in";

        // Register Merchant A & Merchant B
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "businessName", "Merchant Alpha",
                                "ownerName", "Alpha Owner",
                                "email", emailA,
                                "password", "StrongPassword123!"
                        ))))
                .andExpect(status().isCreated());

        MvcResult regB = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "businessName", "Merchant Beta",
                                "ownerName", "Beta Owner",
                                "email", emailB,
                                "password", "StrongPassword123!"
                        ))))
                .andExpect(status().isCreated())
                .andReturn();

        String merchantBId = objectMapper
                .readTree(regB.getResponse().getContentAsString())
                .at("/data/workspace/merchantId")
                .asText();

        // Login as Merchant A
        MvcResult loginA = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", emailA,
                                "password", "StrongPassword123!"
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        String tokenA = objectMapper
                .readTree(loginA.getResponse().getContentAsString())
                .at("/data/accessToken")
                .asText();

        // Attack 1: Merchant A tries to select Merchant B's workspace
        mockMvc.perform(post("/api/v1/auth/select-workspace")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("merchantId", merchantBId))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("TENANT_ACCESS_DENIED"));

        // Attack 2: Merchant A tries to read Merchant B's workspace details via ID manipulation
        mockMvc.perform(get("/api/v1/merchants/" + merchantBId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenA))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("TENANT_ACCESS_DENIED"));

        // Attack 3: Merchant A tries to modify Merchant B's business name
        mockMvc.perform(patch("/api/v1/merchants/" + merchantBId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("businessName", "Hijacked Beta"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("TENANT_ACCESS_DENIED"));
    }

    @Test
    void multiWorkspaceMembershipAndRoleBasedAuthorizationPreventViewerFromOwnerActions() throws Exception {
        String ownerEmail = "multi.owner." + UUID.randomUUID().toString().substring(0, 6) + "@ordexa.in";
        String viewerEmail = "viewer.user." + UUID.randomUUID().toString().substring(0, 6) + "@ordexa.in";
        String secondOwnerEmail = "second.owner." + UUID.randomUUID().toString().substring(0, 6) + "@ordexa.in";

        // 1. Register Workspace 1
        MvcResult reg1 = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "businessName", "VedaGlow Primary",
                                "ownerName", "Ananya Mehta",
                                "email", ownerEmail,
                                "password", "StrongPassword123!"
                        ))))
                .andExpect(status().isCreated())
                .andReturn();
        String merchant1Id = objectMapper
                .readTree(reg1.getResponse().getContentAsString())
                .at("/data/workspace/merchantId")
                .asText();

        // 2. Register Workspace 2
        MvcResult reg2 = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "businessName", "KoraCraft Living",
                                "ownerName", "Kora Founder",
                                "email", secondOwnerEmail,
                                "password", "StrongPassword123!"
                        ))))
                .andExpect(status().isCreated())
                .andReturn();
        String merchant2Id = objectMapper
                .readTree(reg2.getResponse().getContentAsString())
                .at("/data/workspace/merchantId")
                .asText();

        // 3. Login as Workspace 1 Owner and add viewerEmail as VIEWER
        MvcResult loginOwner1 = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", ownerEmail,
                                "password", "StrongPassword123!"
                        ))))
                .andExpect(status().isOk())
                .andReturn();
        String owner1Token = objectMapper
                .readTree(loginOwner1.getResponse().getContentAsString())
                .at("/data/accessToken")
                .asText();

        mockMvc.perform(post("/api/v1/merchants/" + merchant1Id + "/members")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + owner1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Priya Viewer",
                                "email", viewerEmail,
                                "initialPassword", "StrongPassword123!",
                                "role", "VIEWER"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.role").value("VIEWER"));

        // 4. Login as Workspace 2 Owner and add viewerEmail as MANAGER in Workspace 2
        MvcResult loginOwner2 = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", secondOwnerEmail,
                                "password", "StrongPassword123!"
                        ))))
                .andExpect(status().isOk())
                .andReturn();
        String owner2Token = objectMapper
                .readTree(loginOwner2.getResponse().getContentAsString())
                .at("/data/accessToken")
                .asText();

        mockMvc.perform(post("/api/v1/merchants/" + merchant2Id + "/members")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + owner2Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Priya Viewer",
                                "email", viewerEmail,
                                "initialPassword", "StrongPassword123!",
                                "role", "MANAGER"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.role").value("MANAGER"));

        // 5. Login as viewerEmail (now belongs to TWO workspaces!)
        MvcResult loginMulti = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", viewerEmail,
                                "password", "StrongPassword123!"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.requiresWorkspaceSelection").value(true))
                .andExpect(jsonPath("$.data.workspaces.length()").value(2))
                .andReturn();

        String initialMultiToken = objectMapper
                .readTree(loginMulti.getResponse().getContentAsString())
                .at("/data/accessToken")
                .asText();

        // 6. Select Workspace 1 (role = VIEWER)
        MvcResult selectWs1 = mockMvc.perform(post("/api/v1/auth/select-workspace")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + initialMultiToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("merchantId", merchant1Id))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.activeWorkspace.merchantId").value(merchant1Id))
                .andExpect(jsonPath("$.data.activeWorkspace.role").value("VIEWER"))
                .andReturn();

        String ws1ViewerToken = objectMapper
                .readTree(selectWs1.getResponse().getContentAsString())
                .at("/data/accessToken")
                .asText();

        // VIEWER can read Workspace 1
        mockMvc.perform(get("/api/v1/merchants/" + merchant1Id)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + ws1ViewerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.currentUserRole").value("VIEWER"));

        // VIEWER CANNOT perform OWNER action (rename Workspace 1) -> 403 FORBIDDEN
        mockMvc.perform(patch("/api/v1/merchants/" + merchant1Id)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + ws1ViewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("businessName", "Unauthorized Rename"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));

        // While scoped to Workspace 1, user CANNOT access Workspace 2 until switching workspaces
        mockMvc.perform(get("/api/v1/merchants/" + merchant2Id)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + ws1ViewerToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("TENANT_ACCESS_DENIED"));

        // 7. Switch to Workspace 2 (role = MANAGER)
        MvcResult selectWs2 = mockMvc.perform(post("/api/v1/auth/select-workspace")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + ws1ViewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("merchantId", merchant2Id))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.activeWorkspace.merchantId").value(merchant2Id))
                .andExpect(jsonPath("$.data.activeWorkspace.role").value("MANAGER"))
                .andReturn();

        String ws2ManagerToken = objectMapper
                .readTree(selectWs2.getResponse().getContentAsString())
                .at("/data/accessToken")
                .asText();

        mockMvc.perform(get("/api/v1/merchants/" + merchant2Id)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + ws2ManagerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.businessName").value("KoraCraft Living"))
                .andExpect(jsonPath("$.data.currentUserRole").value("MANAGER"));
    }
}
