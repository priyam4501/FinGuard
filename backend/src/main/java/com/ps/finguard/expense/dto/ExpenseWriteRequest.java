package com.ps.finguard.expense.dto;

import com.ps.finguard.expense.entity.SplitStrategy;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record ExpenseWriteRequest(
        @NotNull UUID payerId,
        @NotNull @DecimalMin(value = "0.01") @Digits(integer = 8, fraction = 2) BigDecimal amount,
        @NotBlank @Size(min = 1, max = 255) String description,
        @NotNull SplitStrategy strategy,
        @NotNull @Size(min = 1) @Valid List<SplitInput> splits
) {
    public record SplitInput(
            @NotNull UUID userId,
            @NotNull @DecimalMin(value = "0.00") @Digits(integer = 8, fraction = 2) BigDecimal amountOwed
    ) {}
}
