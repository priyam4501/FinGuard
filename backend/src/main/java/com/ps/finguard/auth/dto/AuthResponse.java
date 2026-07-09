package com.ps.finguard.auth.dto;

import com.ps.finguard.profile.dto.UserResponse;

public record AuthResponse(String token, long expiresInSeconds, UserResponse user) {}
