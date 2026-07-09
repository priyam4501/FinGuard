package com.ps.finguard.settlement.dto;

import com.ps.finguard.settlement.entity.SettlementStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record SettlementResponse(
        UUID id,
        UUID groupId,
        UUID fromUserId,
        UUID toUserId,
        BigDecimal amount,
        SettlementStatus status,
        OffsetDateTime generatedAt,
        OffsetDateTime confirmedAt
) {}
