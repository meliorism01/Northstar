package com.ordexa.auth.security;

import com.ordexa.common.exception.ErrorCode;
import com.ordexa.common.exception.OrdexaException;
import com.ordexa.membership.entity.MerchantRole;
import com.ordexa.user.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtBuilder;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class JwtTokenService {

    public static final String CLAIM_TOKEN_TYPE = "typ";
    public static final String TOKEN_TYPE_ACCESS = "ACCESS";
    public static final String CLAIM_EMAIL = "email";
    public static final String CLAIM_NAME = "name";
    public static final String CLAIM_SESSION_ID = "sid";
    public static final String CLAIM_MERCHANT_ID = "mid";
    public static final String CLAIM_ROLE = "role";

    private final JwtProperties jwtProperties;
    private final Clock clock;
    private final SecretKey signingKey;

    public JwtTokenService(JwtProperties jwtProperties, Clock clock) {
        this.jwtProperties = jwtProperties;
        this.clock = clock;
        String secret = jwtProperties.getSecret();
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException(
                    "JWT signing secret (ordexa.security.jwt.secret / JWT_SECRET) must be at least 32 bytes (256 bits).");
        }
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateAccessToken(
            User user,
            UUID sessionId,
            UUID activeMerchantId,
            MerchantRole role) {
        Instant now = Instant.now(clock);
        Instant expiresAt = now.plusSeconds(jwtProperties.getAccessTokenTtlSeconds());

        JwtBuilder builder = Jwts.builder()
                .id(UUID.randomUUID().toString())
                .issuer(jwtProperties.getIssuer())
                .subject(user.getId().toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiresAt))
                .claim(CLAIM_TOKEN_TYPE, TOKEN_TYPE_ACCESS)
                .claim(CLAIM_EMAIL, user.getEmail())
                .claim(CLAIM_NAME, user.getFullName())
                .claim(CLAIM_SESSION_ID, sessionId.toString());

        if (activeMerchantId != null) {
            builder.claim(CLAIM_MERCHANT_ID, activeMerchantId.toString());
        }
        if (role != null) {
            builder.claim(CLAIM_ROLE, role.name());
        }

        return builder.signWith(signingKey, Jwts.SIG.HS256).compact();
    }

    public JwtClaimsPrincipal parseAndValidateAccessToken(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(signingKey)
                    .requireIssuer(jwtProperties.getIssuer())
                    .clock(() -> Date.from(Instant.now(clock)))
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            String tokenType = claims.get(CLAIM_TOKEN_TYPE, String.class);
            if (!TOKEN_TYPE_ACCESS.equals(tokenType)) {
                throw new OrdexaException(
                        "Invalid token type",
                        ErrorCode.TOKEN_INVALID,
                        HttpStatus.UNAUTHORIZED);
            }

            UUID userId = UUID.fromString(claims.getSubject());
            String email = claims.get(CLAIM_EMAIL, String.class);
            String fullName = claims.get(CLAIM_NAME, String.class);
            UUID sessionId = UUID.fromString(claims.get(CLAIM_SESSION_ID, String.class));

            String midRaw = claims.get(CLAIM_MERCHANT_ID, String.class);
            UUID activeMerchantId = (midRaw != null && !midRaw.isBlank()) ? UUID.fromString(midRaw) : null;

            String roleRaw = claims.get(CLAIM_ROLE, String.class);
            MerchantRole role = (roleRaw != null && !roleRaw.isBlank()) ? MerchantRole.valueOf(roleRaw) : null;

            return new JwtClaimsPrincipal(userId, email, fullName, sessionId, activeMerchantId, role);
        } catch (ExpiredJwtException ex) {
            throw new OrdexaException(
                    "Access token has expired",
                    ErrorCode.TOKEN_EXPIRED,
                    HttpStatus.UNAUTHORIZED);
        } catch (OrdexaException ex) {
            throw ex;
        } catch (JwtException | IllegalArgumentException ex) {
            throw new OrdexaException(
                    "Invalid or malformed access token",
                    ErrorCode.TOKEN_INVALID,
                    HttpStatus.UNAUTHORIZED);
        }
    }

    public long getAccessTokenTtlSeconds() {
        return jwtProperties.getAccessTokenTtlSeconds();
    }
}
