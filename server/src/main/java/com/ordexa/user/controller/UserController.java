package com.ordexa.user.controller;

import com.ordexa.common.response.ApiResponse;
import com.ordexa.user.dto.UserProfileDto;
import com.ordexa.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Clock;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "Users", description = "Authenticated operator profile endpoints")
public class UserController {

    private final UserService userService;
    private final Clock clock;

    public UserController(UserService userService, Clock clock) {
        this.userService = userService;
        this.clock = clock;
    }

    @GetMapping("/me")
    @Operation(summary = "Get current authenticated user profile")
    public ResponseEntity<ApiResponse<UserProfileDto>> getCurrentUser() {
        UserProfileDto profile = userService.getCurrentUserProfile();
        return ResponseEntity.ok(ApiResponse.success("User profile retrieved", profile, clock));
    }
}
