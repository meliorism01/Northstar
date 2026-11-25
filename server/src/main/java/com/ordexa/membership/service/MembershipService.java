package com.ordexa.membership.service;

import com.ordexa.membership.dto.MemberSummaryDto;
import com.ordexa.membership.entity.MerchantMembership;
import com.ordexa.membership.repository.MerchantMembershipRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MembershipService {

    private final MerchantMembershipRepository membershipRepository;

    public MembershipService(MerchantMembershipRepository membershipRepository) {
        this.membershipRepository = membershipRepository;
    }

    @Transactional(readOnly = true)
    public List<MemberSummaryDto> listMembersForMerchant(UUID merchantId) {
        return membershipRepository.findAllByMerchantIdWithUser(merchantId)
                .stream()
                .map(this::toMemberDto)
                .toList();
    }

    public MemberSummaryDto toMemberDto(MerchantMembership m) {
        return new MemberSummaryDto(
                m.getId(),
                m.getUser().getId(),
                m.getUser().getFullName(),
                m.getUser().getEmail(),
                m.getRole(),
                m.getStatus(),
                m.getCreatedAt()
        );
    }
}
