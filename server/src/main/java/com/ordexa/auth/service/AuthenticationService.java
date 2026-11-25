package com.ordexa.auth.service;

import com.ordexa.auth.dto.AuthSessionResponse;
import com.ordexa.auth.dto.LoginRequest;
import com.ordexa.auth.dto.RegisterRequest;
import com.ordexa.auth.dto.RegisterResponse;
import com.ordexa.auth.dto.SelectWorkspaceRequest;
import com.ordexa.auth.dto.WorkspacesResponse;
import com.ordexa.auth.entity.AuditLog;
import com.ordexa.auth.entity.AuthenticationSession;
import com.ordexa.auth.entity.RefreshToken;
import com.ordexa.auth.entity.SessionStatus;
import com.ordexa.auth.security.JwtProperties;
import com.ordexa.auth.security.JwtTokenService;
import com.ordexa.auth.security.PasswordPolicyValidator;
import com.ordexa.auth.token.AuditLogRepository;
import com.ordexa.auth.token.AuthenticationSessionRepository;
import com.ordexa.auth.token.RefreshTokenRepository;
import com.ordexa.auth.token.TokenHashUtil;
import com.ordexa.common.exception.ErrorCode;
import com.ordexa.common.exception.OrdexaException;
import com.ordexa.membership.dto.WorkspaceSummaryDto;
import com.ordexa.membership.entity.MembershipStatus;
import com.ordexa.membership.entity.MerchantMembership;
import com.ordexa.membership.entity.MerchantRole;
import com.ordexa.membership.repository.MerchantMembershipRepository;
import com.ordexa.merchant.entity.Merchant;
import com.ordexa.merchant.entity.MerchantStatus;
import com.ordexa.merchant.repository.MerchantRepository;
import com.ordexa.tenant.context.TenantContext;
import com.ordexa.tenant.context.TenantContextHolder;
import com.ordexa.user.dto.UserProfileDto;
import com.ordexa.user.entity.User;
import com.ordexa.user.entity.UserStatus;
import com.ordexa.user.repository.UserRepository;
import java.text.Normalizer;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthenticationService {

    public record AuthResultWithRefreshCookie(AuthSessionResponse session, String rawRefreshToken) {
    }

    private final MerchantRepository merchantRepository;
    private final UserRepository userRepository;
    private final MerchantMembershipRepository membershipRepository;
    private final AuthenticationSessionRepository sessionRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final AuditLogRepository auditLogRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final JwtProperties jwtProperties;
    private final Clock clock;

    public AuthenticationService(
            MerchantRepository merchantRepository,
            UserRepository userRepository,
            MerchantMembershipRepository membershipRepository,
            AuthenticationSessionRepository sessionRepository,
            RefreshTokenRepository refreshTokenRepository,
            AuditLogRepository auditLogRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenService jwtTokenService,
            JwtProperties jwtProperties,
            Clock clock) {
        this.merchantRepository = merchantRepository;
        this.userRepository = userRepository;
        this.membershipRepository = membershipRepository;
        this.sessionRepository = sessionRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.auditLogRepository = auditLogRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
        this.jwtProperties = jwtProperties;
        this.clock = clock;
    }

    @Transactional
    public RegisterResponse registerMerchant(RegisterRequest request, String clientIp) {
        String normalizedEmail = normalizeEmail(request.email());
        PasswordPolicyValidator.validate(request.password());

        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new OrdexaException(
                    "An account with this email address already exists",
                    ErrorCode.DUPLICATE_ACCOUNT,
                    HttpStatus.CONFLICT);
        }

        String cleanBusinessName = request.businessName().trim();
        String cleanOwnerName = request.ownerName().trim();
        String uniqueSlug = buildUniqueMerchantSlug(cleanBusinessName);

        Merchant merchant = new Merchant(UUID.randomUUID(), cleanBusinessName, uniqueSlug, MerchantStatus.ACTIVE);
        merchantRepository.save(merchant);

        String hashedPassword = passwordEncoder.encode(request.password());
        User owner = new User(UUID.randomUUID(), cleanOwnerName, normalizedEmail, hashedPassword, UserStatus.ACTIVE);
        userRepository.save(owner);

        MerchantMembership membership = new MerchantMembership(
                UUID.randomUUID(),
                merchant,
                owner,
                MerchantRole.OWNER,
                MembershipStatus.ACTIVE);
        membershipRepository.save(membership);

        auditLogRepository.save(new AuditLog(
                merchant.getId(),
                owner.getId(),
                "MERCHANT_REGISTERED",
                "MERCHANT",
                merchant.getId().toString(),
                "Registered merchant workspace " + cleanBusinessName,
                clientIp));

        return new RegisterResponse(toUserDto(owner), toWorkspaceDto(membership));
    }

    @Transactional
    public AuthResultWithRefreshCookie authenticate(LoginRequest request, String clientIp, String userAgent) {
        String normalizedEmail = normalizeEmail(request.email());
        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new OrdexaException(
                        "Invalid email address or password",
                        ErrorCode.INVALID_CREDENTIALS,
                        HttpStatus.UNAUTHORIZED));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new OrdexaException(
                    "Invalid email address or password",
                    ErrorCode.INVALID_CREDENTIALS,
                    HttpStatus.UNAUTHORIZED);
        }

        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new OrdexaException(
                    "Your user account is not active",
                    ErrorCode.ACCOUNT_INACTIVE,
                    HttpStatus.FORBIDDEN);
        }

        List<MerchantMembership> memberships =
                membershipRepository.findActiveMembershipsWithMerchant(user.getId(), MembershipStatus.ACTIVE);

        if (memberships.isEmpty()) {
            throw new OrdexaException(
                    "No active merchant workspaces are linked to this user account",
                    ErrorCode.TENANT_ACCESS_DENIED,
                    HttpStatus.FORBIDDEN);
        }

        MerchantMembership autoSelected = memberships.size() == 1 ? memberships.get(0) : null;
        Merchant activeMerchant = autoSelected != null ? autoSelected.getMerchant() : null;
        MerchantRole activeRole = autoSelected != null ? autoSelected.getRole() : null;

        OffsetDateTime now = OffsetDateTime.now(clock);
        OffsetDateTime sessionExpiry = now.plusSeconds(jwtProperties.getRefreshTokenTtlSeconds());

        AuthenticationSession session = new AuthenticationSession(
                UUID.randomUUID(),
                user,
                activeMerchant,
                SessionStatus.ACTIVE,
                clientIp,
                truncateUserAgent(userAgent),
                sessionExpiry);
        sessionRepository.save(session);

        String rawRefresh = TokenHashUtil.generateRawRefreshToken();
        RefreshToken refreshToken = new RefreshToken(
                UUID.randomUUID(),
                user,
                TokenHashUtil.sha256Hex(rawRefresh),
                session,
                sessionExpiry);
        refreshTokenRepository.save(refreshToken);

        String accessToken = jwtTokenService.generateAccessToken(
                user,
                session.getId(),
                activeMerchant != null ? activeMerchant.getId() : null,
                activeRole);

        auditLogRepository.save(new AuditLog(
                activeMerchant != null ? activeMerchant.getId() : null,
                user.getId(),
                "USER_LOGIN",
                "SESSION",
                session.getId().toString(),
                "Authenticated user session",
                clientIp));

        List<WorkspaceSummaryDto> workspaceDtos = memberships.stream()
                .map(this::toWorkspaceDto)
                .toList();

        AuthSessionResponse response = new AuthSessionResponse(
                accessToken,
                jwtTokenService.getAccessTokenTtlSeconds(),
                toUserDto(user),
                workspaceDtos,
                autoSelected != null ? toWorkspaceDto(autoSelected) : null,
                autoSelected == null);

        return new AuthResultWithRefreshCookie(response, rawRefresh);
    }

    @Transactional(noRollbackFor = OrdexaException.class)
    public AuthResultWithRefreshCookie rotateRefreshToken(String rawRefreshToken, String clientIp) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new OrdexaException(
                    "Refresh token is missing",
                    ErrorCode.UNAUTHORIZED,
                    HttpStatus.UNAUTHORIZED);
        }

        String hash = TokenHashUtil.sha256Hex(rawRefreshToken);
        RefreshToken storedToken = refreshTokenRepository.findByTokenHashWithDetails(hash)
                .orElseThrow(() -> new OrdexaException(
                        "Invalid refresh token",
                        ErrorCode.TOKEN_INVALID,
                        HttpStatus.UNAUTHORIZED));

        OffsetDateTime now = OffsetDateTime.now(clock);
        AuthenticationSession session = storedToken.getSession();

        if (storedToken.isRevoked()) {
            revokeEntireSession(session, now);
            auditLogRepository.save(new AuditLog(
                    session.getActiveMerchant() != null ? session.getActiveMerchant().getId() : null,
                    storedToken.getUser().getId(),
                    "REFRESH_TOKEN_REPLAY_DETECTED",
                    "SESSION",
                    session.getId().toString(),
                    "Revoked session after replay attempt on refresh token " + storedToken.getId(),
                    clientIp));
            throw new OrdexaException(
                    "Refresh token replay detected; session has been revoked",
                    ErrorCode.REFRESH_TOKEN_REPLAY,
                    HttpStatus.UNAUTHORIZED);
        }

        if (storedToken.getExpiresAt().isBefore(now)
                || session.getStatus() != SessionStatus.ACTIVE
                || session.getExpiresAt().isBefore(now)) {
            revokeEntireSession(session, now);
            throw new OrdexaException(
                    "Refresh token has expired",
                    ErrorCode.TOKEN_EXPIRED,
                    HttpStatus.UNAUTHORIZED);
        }

        User user = storedToken.getUser();
        if (user.getStatus() != UserStatus.ACTIVE) {
            revokeEntireSession(session, now);
            throw new OrdexaException(
                    "User account is no longer active",
                    ErrorCode.ACCOUNT_INACTIVE,
                    HttpStatus.FORBIDDEN);
        }

        String nextRawRefresh = TokenHashUtil.generateRawRefreshToken();
        OffsetDateTime nextExpiry = now.plusSeconds(jwtProperties.getRefreshTokenTtlSeconds());
        RefreshToken nextToken = new RefreshToken(
                UUID.randomUUID(),
                user,
                TokenHashUtil.sha256Hex(nextRawRefresh),
                session,
                nextExpiry);
        refreshTokenRepository.save(nextToken);

        storedToken.revoke(now, nextToken.getId());
        refreshTokenRepository.save(storedToken);

        List<MerchantMembership> memberships =
                membershipRepository.findActiveMembershipsWithMerchant(user.getId(), MembershipStatus.ACTIVE);

        Merchant activeMerchant = session.getActiveMerchant();
        MerchantMembership activeMembership = null;
        if (activeMerchant != null) {
            activeMembership = memberships.stream()
                    .filter(m -> m.getMerchant().getId().equals(activeMerchant.getId()))
                    .findFirst()
                    .orElse(null);
        }
        if (activeMembership == null && memberships.size() == 1) {
            activeMembership = memberships.get(0);
            session.setActiveMerchant(activeMembership.getMerchant());
            sessionRepository.save(session);
        }

        String newAccessToken = jwtTokenService.generateAccessToken(
                user,
                session.getId(),
                activeMembership != null ? activeMembership.getMerchant().getId() : null,
                activeMembership != null ? activeMembership.getRole() : null);

        List<WorkspaceSummaryDto> workspaceDtos = memberships.stream()
                .map(this::toWorkspaceDto)
                .toList();

        AuthSessionResponse response = new AuthSessionResponse(
                newAccessToken,
                jwtTokenService.getAccessTokenTtlSeconds(),
                toUserDto(user),
                workspaceDtos,
                activeMembership != null ? toWorkspaceDto(activeMembership) : null,
                activeMembership == null);

        return new AuthResultWithRefreshCookie(response, nextRawRefresh);
    }

    @Transactional(readOnly = true)
    public WorkspacesResponse listAccessibleWorkspaces() {
        TenantContext ctx = TenantContextHolder.requireAuthenticatedUser();
        List<WorkspaceSummaryDto> workspaces = membershipRepository
                .findActiveMembershipsWithMerchant(ctx.userId(), MembershipStatus.ACTIVE)
                .stream()
                .map(this::toWorkspaceDto)
                .toList();
        return new WorkspacesResponse(workspaces, ctx.merchantId());
    }

    @Transactional(noRollbackFor = OrdexaException.class)
    public AuthSessionResponse selectWorkspace(SelectWorkspaceRequest request, String clientIp) {
        TenantContext ctx = TenantContextHolder.requireAuthenticatedUser();
        UUID targetMerchantId = request.merchantId();

        MerchantMembership membership = membershipRepository
                .findByMerchantIdAndUserIdWithDetails(targetMerchantId, ctx.userId())
                .orElseThrow(() -> {
                    auditLogRepository.save(new AuditLog(
                            targetMerchantId,
                            ctx.userId(),
                            "CROSS_TENANT_ACCESS_BLOCKED",
                            "MERCHANT",
                            targetMerchantId.toString(),
                            "Rejected unauthorized workspace selection attempt",
                            clientIp));
                    return new OrdexaException(
                            "Access denied: you are not a member of the requested merchant workspace",
                            ErrorCode.TENANT_ACCESS_DENIED,
                            HttpStatus.FORBIDDEN);
                });

        if (membership.getStatus() != MembershipStatus.ACTIVE
                || membership.getMerchant().getStatus() != MerchantStatus.ACTIVE) {
            throw new OrdexaException(
                    "The requested merchant workspace or membership is not active",
                    ErrorCode.TENANT_ACCESS_DENIED,
                    HttpStatus.FORBIDDEN);
        }

        AuthenticationSession session = sessionRepository.findByIdWithUserAndMerchant(ctx.sessionId())
                .orElseThrow(() -> new OrdexaException(
                        "Active authentication session not found",
                        ErrorCode.UNAUTHORIZED,
                        HttpStatus.UNAUTHORIZED));

        session.setActiveMerchant(membership.getMerchant());
        sessionRepository.save(session);

        User user = membership.getUser();
        String scopedAccessToken = jwtTokenService.generateAccessToken(
                user,
                session.getId(),
                membership.getMerchant().getId(),
                membership.getRole());

        List<WorkspaceSummaryDto> workspaceDtos = membershipRepository
                .findActiveMembershipsWithMerchant(user.getId(), MembershipStatus.ACTIVE)
                .stream()
                .map(this::toWorkspaceDto)
                .toList();

        auditLogRepository.save(new AuditLog(
                membership.getMerchant().getId(),
                user.getId(),
                "WORKSPACE_SELECTED",
                "MERCHANT",
                membership.getMerchant().getId().toString(),
                "Selected active workspace with role " + membership.getRole(),
                clientIp));

        return new AuthSessionResponse(
                scopedAccessToken,
                jwtTokenService.getAccessTokenTtlSeconds(),
                toUserDto(user),
                workspaceDtos,
                toWorkspaceDto(membership),
                false);
    }

    @Transactional
    public void logout(String rawRefreshToken, String clientIp) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        TenantContextHolder.getContext().ifPresent(ctx -> {
            sessionRepository.findById(ctx.sessionId()).ifPresent(session -> {
                revokeEntireSession(session, now);
                auditLogRepository.save(new AuditLog(
                        ctx.merchantId(),
                        ctx.userId(),
                        "USER_LOGOUT",
                        "SESSION",
                        session.getId().toString(),
                        "Revoked session via authenticated logout",
                        clientIp));
            });
        });

        if (rawRefreshToken != null && !rawRefreshToken.isBlank()) {
            String hash = TokenHashUtil.sha256Hex(rawRefreshToken);
            refreshTokenRepository.findByTokenHashWithDetails(hash).ifPresent(rt -> {
                revokeEntireSession(rt.getSession(), now);
            });
        }
    }

    private void revokeEntireSession(AuthenticationSession session, OffsetDateTime when) {
        session.revoke(when);
        sessionRepository.save(session);
        List<RefreshToken> activeTokens = refreshTokenRepository.findAllActiveBySessionId(session.getId());
        for (RefreshToken token : activeTokens) {
            token.revoke(when, null);
        }
        refreshTokenRepository.saveAll(activeTokens);
    }

    private String normalizeEmail(String rawEmail) {
        if (rawEmail == null) {
            return "";
        }
        return rawEmail.trim().toLowerCase(Locale.ROOT);
    }

    private String buildUniqueMerchantSlug(String businessName) {
        String normalized = Normalizer.normalize(businessName, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        String baseSlug = normalized.isBlank() ? "merchant" : normalized;
        if (!merchantRepository.existsByBusinessSlug(baseSlug)) {
            return baseSlug;
        }
        String candidate = baseSlug + "-" + UUID.randomUUID().toString().substring(0, 6);
        while (merchantRepository.existsByBusinessSlug(candidate)) {
            candidate = baseSlug + "-" + UUID.randomUUID().toString().substring(0, 6);
        }
        return candidate;
    }

    private String truncateUserAgent(String ua) {
        if (ua == null) {
            return null;
        }
        return ua.length() > 500 ? ua.substring(0, 500) : ua;
    }

    private UserProfileDto toUserDto(User user) {
        return new UserProfileDto(user.getId(), user.getFullName(), user.getEmail(), user.getStatus());
    }

    private WorkspaceSummaryDto toWorkspaceDto(MerchantMembership membership) {
        Merchant m = membership.getMerchant();
        return new WorkspaceSummaryDto(
                m.getId(),
                m.getBusinessName(),
                m.getBusinessSlug(),
                membership.getRole(),
                m.getStatus().name());
    }
}
