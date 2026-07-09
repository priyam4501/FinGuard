package com.ps.finguard.profile.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.hibernate.validator.constraints.URL;

public record UpdateProfileRequest(
        @NotBlank @Size(min = 1, max = 100) String fullName,
        @URL @Size(max = 1000) String avatarUrl
) {}
