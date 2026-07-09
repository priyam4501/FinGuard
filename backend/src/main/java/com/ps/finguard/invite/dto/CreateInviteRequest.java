package com.ps.finguard.invite.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateInviteRequest(
        @NotBlank @Email @Size(max = 255) String email
) {}
