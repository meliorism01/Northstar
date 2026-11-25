package com.ordexa.user.service;

import com.ordexa.common.exception.ResourceNotFoundException;
import com.ordexa.tenant.context.TenantContext;
import com.ordexa.tenant.context.TenantContextHolder;
import com.ordexa.user.dto.UserProfileDto;
import com.ordexa.user.entity.User;
import com.ordexa.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public UserProfileDto getCurrentUserProfile() {
        TenantContext ctx = TenantContextHolder.requireAuthenticatedUser();
        User user = userRepository.findById(ctx.userId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return new UserProfileDto(user.getId(), user.getFullName(), user.getEmail(), user.getStatus());
    }
}
