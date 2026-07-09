package com.ps.finguard.invite.dto;

import com.ps.finguard.invite.entity.InviteStatus;

import java.time.OffsetDateTime;
import java.util.UUID;

public record InviteResponse(
        UUID id,
        UUID groupId,
        String groupName,
        String invitedEmail,
        InviteStatus status,
        OffsetDateTime createdAt
) {}
