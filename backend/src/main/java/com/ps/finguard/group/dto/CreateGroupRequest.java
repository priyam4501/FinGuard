package com.ps.finguard.group.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateGroupRequest(
        @NotBlank @Size(min = 1, max = 100) String name,
        @Size(min = 3, max = 3) String currency
) {}
