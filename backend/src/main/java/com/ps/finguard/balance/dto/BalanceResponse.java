package com.ps.finguard.balance.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record BalanceResponse(
        UUID userId,
        String fullName,
        String email,
        BigDecimal totalPaid,
        BigDecimal totalOwed,
        BigDecimal netBalance
) {}
