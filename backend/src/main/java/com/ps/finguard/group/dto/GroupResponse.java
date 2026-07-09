package com.ps.finguard.group.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record GroupResponse(
        UUID id,
        String name,
        String currency,
        UUID createdBy,
        OffsetDateTime createdAt
) {}
