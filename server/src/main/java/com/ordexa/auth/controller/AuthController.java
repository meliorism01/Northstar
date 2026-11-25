package com.ordexa.auth.controller;

import com.ordexa.auth.dto.AuthSessionResponse;
import com.ordexa.auth.dto.LoginRequest;
import com.ordexa.auth.dto.RegisterRequest;
import com.ordexa.auth.dto.RegisterResponse;
import com.ordexa.auth.dto.SelectWorkspaceRequest;
import com.ordexa.auth.dto.WorkspacesResponse;
import com.ordexa.auth.security.JwtProperties;
import com.ordexa.auth.service.AuthenticationService;
import com.ordexa.auth.service.AuthenticationService.AuthResultWithRefreshCookie;
import com.ordexa.common.exception.ErrorCode;
import com.ordexa.common.exception.OrdexaException;
import com.ordexa.common.response.ApiResponse;
import com.ordexa.config.CorsProperties;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentication & Workspaces", description = "Multi-tenant merchant registration, login, token rotation, and workspace switching")
public class AuthController {

    private static final String REFRESH_COOKIE_PATH = "/api/v1/auth";

    private final AuthenticationService authenticationService;
    private final JwtProperties jwtProperties;
    private final CorsProperties corsProperties;
    private final Clock clock;

    public AuthController(
            AuthenticationService authenticationService,
            JwtProperties jwtProperties,
            CorsProperties corsProperties,
            Clock clock) {
        this.authenticationService = authenticationService;
        this.jwtProperties = jwtProperties;
        this.corsProperties = corsProperties;
        this.clock = clock;
    }

    @PostMapping("/register")
    @Operation(summary = "Register a new merchant workspace and owner account")
    public ResponseEntity<ApiResponse<RegisterResponse>> register(
            @Valid @RequestBody RegisterRequest request,
            HttpServletRequest servletRequest) {
        RegisterResponse result = authenticationService.registerMerchant(request, servletRequest.getRemoteAddr());
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Merchant account registered successfully", result, clock));
    }

    @PostMapping("/login")
    @Operation(summary = "Authenticate with email and password")
    public ResponseEntity<ApiResponse<AuthSessionResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest servletRequest) {
        AuthResultWithRefreshCookie result = authenticationService.authenticate(
                request,
                servletRequest.getRemoteAddr(),
                servletRequest.getHeader(HttpHeaders.USER_AGENT));

        ResponseCookie cookie = buildRefreshCookie(result.rawRefreshToken(), jwtProperties.getRefreshTokenTtlSeconds());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(ApiResponse.success("Login successful", result.session(), clock));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Rotate HttpOnly refresh token and issue a fresh JWT access token")
    public ResponseEntity<ApiResponse<AuthSessionResponse>> refresh(HttpServletRequest servletRequest) {
        verifyCookieCsrfOrigin(servletRequest);
        String rawRefreshToken = extractRefreshCookie(servletRequest);
        AuthResultWithRefreshCookie result =
                authenticationService.rotateRefreshToken(rawRefreshToken, servletRequest.getRemoteAddr());

        ResponseCookie cookie = buildRefreshCookie(result.rawRefreshToken(), jwtProperties.getRefreshTokenTtlSeconds());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(ApiResponse.success("Session refreshed", result.session(), clock));
    }

    @PostMapping("/logout")
    @Operation(summary = "Revoke active session and clear refresh cookie")
    public ResponseEntity<ApiResponse<Void>> logout(HttpServletRequest servletRequest) {
        verifyCookieCsrfOrigin(servletRequest);
        String rawRefreshToken = extractRefreshCookie(servletRequest);
        authenticationService.logout(rawRefreshToken, servletRequest.getRemoteAddr());

        ResponseCookie clearCookie = buildRefreshCookie("", 0L);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, clearCookie.toString())
                .body(ApiResponse.success("Logged out successfully", null, clock));
    }

    @GetMapping("/workspaces")
    @Operation(summary = "List all active merchant workspaces accessible to the authenticated user")
    public ResponseEntity<ApiResponse<WorkspacesResponse>> listWorkspaces() {
        WorkspacesResponse workspaces = authenticationService.listAccessibleWorkspaces();
        return ResponseEntity.ok(ApiResponse.success("Accessible workspaces retrieved", workspaces, clock));
    }

    @PostMapping("/select-workspace")
    @Operation(summary = "Select an active merchant workspace and receive a workspace-scoped JWT")
    public ResponseEntity<ApiResponse<AuthSessionResponse>> selectWorkspace(
            @Valid @RequestBody SelectWorkspaceRequest request,
            HttpServletRequest servletRequest) {
        AuthSessionResponse response =
                authenticationService.selectWorkspace(request, servletRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success("Active workspace updated", response, clock));
    }

    private String extractRefreshCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        String targetName = jwtProperties.getCookieName();
        for (Cookie cookie : cookies) {
            if (targetName.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private ResponseCookie buildRefreshCookie(String value, long maxAgeSeconds) {
        return ResponseCookie.from(jwtProperties.getCookieName(), value)
                .httpOnly(true)
                .secure(jwtProperties.isCookieSecure())
                .sameSite(jwtProperties.getCookieSameSite())
                .path(REFRESH_COOKIE_PATH)
                .maxAge(Duration.ofSeconds(maxAgeSeconds))
                .build();
    }

    private void verifyCookieCsrfOrigin(HttpServletRequest request) {
        String origin = request.getHeader(HttpHeaders.ORIGIN);
        if (origin != null && !origin.isBlank()) {
            List<String> allowed = corsProperties.resolveOriginList();
            if (!allowed.contains(origin)) {
                throw new OrdexaException(
                        "Cross-origin cookie request rejected by CSRF origin policy",
                        ErrorCode.CSRF_PROTECTION_FAILED,
                        HttpStatus.FORBIDDEN);
            }
        }
    }
}
