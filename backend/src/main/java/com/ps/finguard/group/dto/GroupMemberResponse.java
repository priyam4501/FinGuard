package com.ps.finguard.group.dto;

import com.ps.finguard.group.entity.MemberRole;

import java.util.UUID;

public record GroupMemberResponse(
        UUID userId,
        MemberRole role,
        String fullName,
        String email
) {}
