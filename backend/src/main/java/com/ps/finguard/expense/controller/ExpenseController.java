package com.ps.finguard.expense.controller;

import com.ps.finguard.expense.dto.ExpenseResponse;
import com.ps.finguard.expense.dto.ExpenseWriteRequest;
import com.ps.finguard.expense.service.ExpenseService;
import com.ps.finguard.security.AuthUtil;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Tag(name = "Expenses")
@RestController
@RequiredArgsConstructor
public class ExpenseController {

    private final ExpenseService expenseService;

    @GetMapping("/api/groups/{groupId}/expenses")
    public ResponseEntity<List<ExpenseResponse>> list(@PathVariable UUID groupId) {
        return ResponseEntity.ok(expenseService.list(AuthUtil.requireId(), groupId));
    }

    @PostMapping("/api/groups/{groupId}/expenses")
    public ResponseEntity<ExpenseResponse> create(@PathVariable UUID groupId,
                                                  @Valid @RequestBody ExpenseWriteRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(expenseService.create(AuthUtil.requireId(), groupId, req));
    }

    @PatchMapping("/api/expenses/{id}")
    public ResponseEntity<ExpenseResponse> update(@PathVariable UUID id,
                                                  @Valid @RequestBody ExpenseWriteRequest req) {
        return ResponseEntity.ok(expenseService.update(AuthUtil.requireId(), id, req));
    }

    @DeleteMapping("/api/expenses/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        expenseService.delete(AuthUtil.requireId(), id);
        return ResponseEntity.noContent().build();
    }
}
