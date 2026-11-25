package com.ordexa.tenant.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ordexa.auth.entity.AuthenticationSession;
import com.ordexa.auth.entity.SessionStatus;
import com.ordexa.auth.security.JwtClaimsPrincipal;
import com.ordexa.auth.security.JwtTokenService;
import com.ordexa.auth.token.AuthenticationSessionRepository;
import com.ordexa.common.exception.ErrorCode;
import com.ordexa.common.exception.OrdexaException;
import com.ordexa.common.response.ApiResponse;
import com.ordexa.membership.entity.MembershipStatus;
import com.ordexa.membership.entity.MerchantMembership;
import com.ordexa.membership.entity.MerchantRole;
import com.ordexa.membership.repository.MerchantMembershipRepository;
import com.ordexa.merchant.entity.MerchantStatus;
import com.ordexa.tenant.context.TenantContext;
import com.ordexa.tenant.context.TenantContextHolder;
import com.ordexa.user.entity.UserStatus;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtTokenService jwtTokenService;
    private final AuthenticationSessionRepository sessionRepository;
    private final MerchantMembershipRepository membershipRepository;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public JwtAuthenticationFilter(
            JwtTokenService jwtTokenService,
            AuthenticationSessionRepository sessionRepository,
            MerchantMembershipRepository membershipRepository,
            ObjectMapper objectMapper,
            Clock clock) {
        this.jwtTokenService = jwtTokenService;
        this.sessionRepository = sessionRepository;
        this.membershipRepository = membershipRepository;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            filterChain.doFilter(request, response);
            return;
        }

        String rawJwt = authHeader.substring(BEARER_PREFIX.length()).trim();
        if (rawJwt.isEmpty()) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            JwtClaimsPrincipal claims = jwtTokenService.parseAndValidateAccessToken(rawJwt);

            AuthenticationSession session = sessionRepository
                    .findByIdWithUserAndMerchant(claims.sessionId())
                    .orElseThrow(() -> new OrdexaException(
                            "Authentication session not found",
                            ErrorCode.UNAUTHORIZED,
                            HttpStatus.UNAUTHORIZED));

            OffsetDateTime now = OffsetDateTime.now(clock);
            if (session.getStatus() != SessionStatus.ACTIVE
                    || session.getRevokedAt() != null
                    || session.getExpiresAt().isBefore(now)) {
                throw new OrdexaException(
                        "Authentication session has been revoked or expired",
                        ErrorCode.UNAUTHORIZED,
                        HttpStatus.UNAUTHORIZED);
            }

            if (session.getUser().getStatus() != UserStatus.ACTIVE) {
                throw new OrdexaException(
                        "User account is not active",
                        ErrorCode.ACCOUNT_INACTIVE,
                        HttpStatus.FORBIDDEN);
            }

            UUID activeMerchantId = claims.activeMerchantId();
            String merchantName = null;
            String merchantSlug = null;
            MerchantRole authoritativeRole = null;
            List<GrantedAuthority> authorities = new ArrayList<>();
            authorities.add(new SimpleGrantedAuthority("ROLE_AUTHENTICATED_USER"));

            if (activeMerchantId != null) {
                MerchantMembership membership = membershipRepository
                        .findByMerchantIdAndUserIdWithDetails(activeMerchantId, claims.userId())
                        .orElseThrow(() -> new OrdexaException(
                                "Active workspace membership is not authorized",
                                ErrorCode.TENANT_ACCESS_DENIED,
                                HttpStatus.FORBIDDEN));

                if (membership.getStatus() != MembershipStatus.ACTIVE
                        || membership.getMerchant().getStatus() != MerchantStatus.ACTIVE) {
                    throw new OrdexaException(
                            "Workspace or membership is no longer active",
                            ErrorCode.TENANT_ACCESS_DENIED,
                            HttpStatus.FORBIDDEN);
                }

                authoritativeRole = membership.getRole();
                merchantName = membership.getMerchant().getBusinessName();
                merchantSlug = membership.getMerchant().getBusinessSlug();
                for (String authority : authoritativeRole.grantedAuthorities()) {
                    authorities.add(new SimpleGrantedAuthority(authority));
                }
            }

            TenantContext tenantContext = new TenantContext(
                    session.getUser().getId(),
                    session.getUser().getEmail(),
                    session.getUser().getFullName(),
                    session.getId(),
                    activeMerchantId,
                    merchantName,
                    merchantSlug,
                    authoritativeRole
            );

            TenantContextHolder.setContext(tenantContext);

            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(tenantContext, null, authorities);
            SecurityContextHolder.getContext().setAuthentication(authentication);

            filterChain.doFilter(request, response);
        } catch (OrdexaException ex) {
            SecurityContextHolder.clearContext();
            TenantContextHolder.clear();
            response.setStatus(ex.getHttpStatus().value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            ApiResponse<Void> errorBody = ApiResponse.error(ex.getMessage(), ex.getErrorCode().name(), clock);
            objectMapper.writeValue(response.getWriter(), errorBody);
        } finally {
            TenantContextHolder.clear();
        }
    }
}
