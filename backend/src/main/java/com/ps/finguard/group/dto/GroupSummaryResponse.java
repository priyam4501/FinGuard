package com.ps.finguard.group.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record GroupSummaryResponse(
        UUID id,
        String name,
        String currency,
        UUID createdBy,
        OffsetDateTime createdAt,
        long memberCount,
        BigDecimal netBalance
) {}
