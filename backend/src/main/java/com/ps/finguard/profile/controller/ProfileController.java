package com.ps.finguard.profile.controller;

import com.ps.finguard.auth.service.AuthService;
import com.ps.finguard.profile.dto.UpdateProfileRequest;
import com.ps.finguard.profile.dto.UserResponse;
import com.ps.finguard.profile.service.ProfileService;
import com.ps.finguard.security.AuthUtil;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Profile")
@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profileService;
    private final AuthService authService;

    @GetMapping
    public ResponseEntity<UserResponse> me() {
        return ResponseEntity.ok(authService.me(AuthUtil.requireId()));
    }

    @PatchMapping
    public ResponseEntity<UserResponse> update(@Valid @RequestBody UpdateProfileRequest req) {
        return ResponseEntity.ok(profileService.update(AuthUtil.requireId(), req));
    }
}
