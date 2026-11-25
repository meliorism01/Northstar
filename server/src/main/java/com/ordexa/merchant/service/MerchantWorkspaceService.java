package com.ordexa.merchant.service;

import com.ordexa.auth.entity.AuditLog;
import com.ordexa.auth.security.PasswordPolicyValidator;
import com.ordexa.auth.token.AuditLogRepository;
import com.ordexa.common.exception.BusinessRuleException;
import com.ordexa.common.exception.ErrorCode;
import com.ordexa.common.exception.OrdexaException;
import com.ordexa.common.exception.ResourceNotFoundException;
import com.ordexa.membership.dto.MemberSummaryDto;
import com.ordexa.membership.entity.MembershipStatus;
import com.ordexa.membership.entity.MerchantMembership;
import com.ordexa.membership.entity.MerchantRole;
import com.ordexa.membership.repository.MerchantMembershipRepository;
import com.ordexa.membership.service.MembershipService;
import com.ordexa.merchant.dto.AddWorkspaceMemberRequest;
import com.ordexa.merchant.dto.MerchantWorkspaceDetailDto;
import com.ordexa.merchant.dto.UpdateMerchantRequest;
import com.ordexa.merchant.entity.Merchant;
import com.ordexa.merchant.repository.MerchantRepository;
import com.ordexa.tenant.context.TenantContext;
import com.ordexa.tenant.context.TenantContextHolder;
import com.ordexa.user.entity.User;
import com.ordexa.user.entity.UserStatus;
import com.ordexa.user.repository.UserRepository;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MerchantWorkspaceService {

    private final MerchantRepository merchantRepository;
    private final MerchantMembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final MembershipService membershipService;
    private final AuditLogRepository auditLogRepository;
    private final PasswordEncoder passwordEncoder;

    public MerchantWorkspaceService(
            MerchantRepository merchantRepository,
            MerchantMembershipRepository membershipRepository,
            UserRepository userRepository,
            MembershipService membershipService,
            AuditLogRepository auditLogRepository,
            PasswordEncoder passwordEncoder) {
        this.merchantRepository = merchantRepository;
        this.membershipRepository = membershipRepository;
        this.userRepository = userRepository;
        this.membershipService = membershipService;
        this.auditLogRepository = auditLogRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public MerchantWorkspaceDetailDto getCurrentWorkspaceDetails() {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        return getWorkspaceDetails(ctx.merchantId());
    }

    @Transactional(readOnly = true)
    public MerchantWorkspaceDetailDto getWorkspaceDetails(UUID merchantId) {
        TenantContext ctx = TenantContextHolder.requireMerchantMatch(merchantId);
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new ResourceNotFoundException("Merchant workspace not found"));

        List<MerchantMembership> members = membershipRepository.findAllByMerchantIdWithUser(merchantId);
        int activeCount = (int) members.stream()
                .filter(m -> m.getStatus() == MembershipStatus.ACTIVE)
                .count();

        return new MerchantWorkspaceDetailDto(
                merchant.getId(),
                merchant.getBusinessName(),
                merchant.getBusinessSlug(),
                merchant.getStatus(),
                ctx.role(),
                activeCount,
                merchant.getCreatedAt());
    }

    @Transactional
    public MerchantWorkspaceDetailDto updateMerchantBusinessName(
            UUID merchantId,
            UpdateMerchantRequest request,
            String clientIp) {
        TenantContext ctx = TenantContextHolder.requireMerchantMatch(merchantId);
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new ResourceNotFoundException("Merchant workspace not found"));

        merchant.setBusinessName(request.businessName().trim());
        merchantRepository.save(merchant);

        auditLogRepository.save(new AuditLog(
                merchantId,
                ctx.userId(),
                "MERCHANT_UPDATED",
                "MERCHANT",
                merchantId.toString(),
                "Updated business name to " + merchant.getBusinessName(),
                clientIp));

        return getWorkspaceDetails(merchantId);
    }

    @Transactional
    public MemberSummaryDto addMemberToWorkspace(
            UUID merchantId,
            AddWorkspaceMemberRequest request,
            String clientIp) {
        TenantContext ctx = TenantContextHolder.requireMerchantMatch(merchantId);

        if (request.role() == MerchantRole.OWNER && ctx.role() != MerchantRole.OWNER) {
            throw new OrdexaException(
                    "Only an OWNER can assign the OWNER role",
                    ErrorCode.ACCESS_DENIED,
                    HttpStatus.FORBIDDEN);
        }

        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new ResourceNotFoundException("Merchant workspace not found"));

        String normalizedEmail = request.email().trim().toLowerCase(Locale.ROOT);
        User user = userRepository.findByEmailIgnoreCase(normalizedEmail).orElseGet(() -> {
            String rawPassword = (request.initialPassword() != null && !request.initialPassword().isBlank())
                    ? request.initialPassword()
                    : "OrdexaTemp123!";
            PasswordPolicyValidator.validate(rawPassword);
            User created = new User(
                    UUID.randomUUID(),
                    request.fullName().trim(),
                    normalizedEmail,
                    passwordEncoder.encode(rawPassword),
                    UserStatus.ACTIVE);
            return userRepository.save(created);
        });

        if (membershipRepository.findByMerchantIdAndUserIdWithDetails(merchantId, user.getId()).isPresent()) {
            throw new BusinessRuleException("User is already a member of this merchant workspace");
        }

        MerchantMembership membership = new MerchantMembership(
                UUID.randomUUID(),
                merchant,
                user,
                request.role(),
                MembershipStatus.ACTIVE);
        membershipRepository.save(membership);

        auditLogRepository.save(new AuditLog(
                merchantId,
                ctx.userId(),
                "MEMBER_ADDED",
                "MEMBERSHIP",
                membership.getId().toString(),
                "Added member " + normalizedEmail + " with role " + request.role(),
                clientIp));

        return membershipService.toMemberDto(membership);
    }
}
