package com.ps.finguard.expense.dto;

import com.ps.finguard.expense.entity.SplitStrategy;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record ExpenseResponse(
        UUID id,
        UUID groupId,
        UUID payerId,
        BigDecimal amount,
        String description,
        SplitStrategy splitStrategy,
        UUID createdBy,
        OffsetDateTime createdAt,
        boolean editable,
        List<Split> splits
) {
    public record Split(UUID userId, BigDecimal amountOwed) {}
}
