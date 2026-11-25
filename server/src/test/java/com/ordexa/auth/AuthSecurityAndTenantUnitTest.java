package com.ordexa.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.ordexa.auth.security.JwtClaimsPrincipal;
import com.ordexa.auth.security.JwtProperties;
import com.ordexa.auth.security.JwtTokenService;
import com.ordexa.auth.security.PasswordPolicyValidator;
import com.ordexa.auth.token.TokenHashUtil;
import com.ordexa.common.exception.ErrorCode;
import com.ordexa.common.exception.OrdexaException;
import com.ordexa.membership.entity.MerchantRole;
import com.ordexa.tenant.context.TenantContext;
import com.ordexa.tenant.context.TenantContextHolder;
import com.ordexa.user.entity.User;
import com.ordexa.user.entity.UserStatus;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

class AuthSecurityAndTenantUnitTest {

    @AfterEach
    void cleanupTenantContext() {
        TenantContextHolder.clear();
    }

    @Test
    void passwordPolicyValidatorAcceptsStrongPasswordsAndRejectsWeakPasswords() {
        assertThatCode(() -> PasswordPolicyValidator.validate("StrongPassword123!"))
                .doesNotThrowAnyException();

        assertThatThrownBy(() -> PasswordPolicyValidator.validate("Short1!"))
                .isInstanceOf(OrdexaException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.VALIDATION_ERROR);

        assertThatThrownBy(() -> PasswordPolicyValidator.validate("alllowercase123!"))
                .isInstanceOf(OrdexaException.class);

        assertThatThrownBy(() -> PasswordPolicyValidator.validate("NoSpecialChar123"))
                .isInstanceOf(OrdexaException.class);
    }

    @Test
    void bcryptPasswordEncoderHashesAndVerifiesWithoutPlaintext() {
        PasswordEncoder encoder = new BCryptPasswordEncoder(10);
        String raw = "StrongPassword123!";
        String hashed = encoder.encode(raw);

        assertThat(hashed).isNotEqualTo(raw);
        assertThat(hashed).startsWith("$2a$");
        assertThat(encoder.matches(raw, hashed)).isTrue();
        assertThat(encoder.matches("WrongPassword123!", hashed)).isFalse();
    }

    @Test
    void jwtTokenServiceIssuesAndValidatesWorkspaceScopedTokensAndDetectsExpiry() {
        JwtProperties props = new JwtProperties();
        props.setSecret("unit-test-jwt-secret-key-with-at-least-32-bytes-of-entropy");
        props.setIssuer("https://auth.ordexa.unit");
        props.setAccessTokenTtlSeconds(600L);

        Instant now = Instant.parse("2026-11-25T10:00:00Z");
        Clock issueClock = Clock.fixed(now, ZoneOffset.UTC);
        JwtTokenService tokenService = new JwtTokenService(props, issueClock);

        UUID userId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        UUID merchantId = UUID.randomUUID();
        User user = new User(userId, "Rahul Sharma", "rahul@example.com", "hashed", UserStatus.ACTIVE);

        String jwt = tokenService.generateAccessToken(user, sessionId, merchantId, MerchantRole.OWNER);
        JwtClaimsPrincipal principal = tokenService.parseAndValidateAccessToken(jwt);

        assertThat(principal.userId()).isEqualTo(userId);
        assertThat(principal.email()).isEqualTo("rahul@example.com");
        assertThat(principal.fullName()).isEqualTo("Rahul Sharma");
        assertThat(principal.sessionId()).isEqualTo(sessionId);
        assertThat(principal.activeMerchantId()).isEqualTo(merchantId);
        assertThat(principal.role()).isEqualTo(MerchantRole.OWNER);

        // Advance clock past expiration
        Clock expiredClock = Clock.fixed(now.plus(Duration.ofMinutes(15)), ZoneOffset.UTC);
        JwtTokenService expiredValidator = new JwtTokenService(props, expiredClock);

        assertThatThrownBy(() -> expiredValidator.parseAndValidateAccessToken(jwt))
                .isInstanceOf(OrdexaException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.TOKEN_EXPIRED);
    }

    @Test
    void tokenHashUtilGeneratesCryptographicTokensAndDeterministicSha256Hashes() {
        String tokenA = TokenHashUtil.generateRawRefreshToken();
        String tokenB = TokenHashUtil.generateRawRefreshToken();

        assertThat(tokenA).isNotBlank().isNotEqualTo(tokenB);
        String hashA1 = TokenHashUtil.sha256Hex(tokenA);
        String hashA2 = TokenHashUtil.sha256Hex(tokenA);
        assertThat(hashA1).hasSize(64).isEqualTo(hashA2).isNotEqualTo( tokenA );
    }

    @Test
    void merchantRoleHierarchyAndTenantContextIsolationEnforceStrictBoundaries() {
        assertThat(MerchantRole.OWNER.hasAtLeast(MerchantRole.ADMIN)).isTrue();
        assertThat(MerchantRole.ADMIN.hasAtLeast(MerchantRole.OWNER)).isFalse();
        assertThat(MerchantRole.VIEWER.hasAtLeast(MerchantRole.OPERATOR)).isFalse();
        assertThat(MerchantRole.VIEWER.hasAtLeast(MerchantRole.VIEWER)).isTrue();

        UUID userId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        UUID merchantA = UUID.randomUUID();
        UUID merchantB = UUID.randomUUID();

        TenantContextHolder.setContext(new TenantContext(
                userId,
                "owner@merchanta.in",
                "Owner A",
                sessionId,
                merchantA,
                "Merchant A",
                "merchant-a",
                MerchantRole.OWNER));

        assertThat(TenantContextHolder.requireMerchantMatch(merchantA).merchantId()).isEqualTo(merchantA);

        assertThatThrownBy(() -> TenantContextHolder.requireMerchantMatch(merchantB))
                .isInstanceOf(OrdexaException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.TENANT_ACCESS_DENIED);

        TenantContextHolder.clear();
        assertThat(TenantContextHolder.getContext()).isEmpty();
    }

    @Test
    void dtoToStringRedactsPasswordsAndAccessTokensFromLogs() {
        com.ordexa.auth.dto.LoginRequest loginReq =
                new com.ordexa.auth.dto.LoginRequest("rahul@example.com", "SuperSecret123!");
        com.ordexa.auth.dto.RegisterRequest regReq =
                new com.ordexa.auth.dto.RegisterRequest("ABC", "Rahul", "rahul@example.com", "SuperSecret123!");
        com.ordexa.merchant.dto.AddWorkspaceMemberRequest memberReq =
                new com.ordexa.merchant.dto.AddWorkspaceMemberRequest(
                        "Priya", "priya@example.com", "SuperSecret123!", MerchantRole.VIEWER);
        com.ordexa.auth.dto.AuthSessionResponse sessionRes =
                new com.ordexa.auth.dto.AuthSessionResponse("eyJhbGciOi.secret.jwt", 900L, null, java.util.List.of(), null, false);

        assertThat(loginReq.toString()).contains("[REDACTED]").doesNotContain("SuperSecret123!");
        assertThat(regReq.toString()).contains("[REDACTED]").doesNotContain("SuperSecret123!");
        assertThat(memberReq.toString()).contains("[REDACTED]").doesNotContain("SuperSecret123!");
        assertThat(sessionRes.toString()).contains("[REDACTED]").doesNotContain("eyJhbGciOi");
    }
}
