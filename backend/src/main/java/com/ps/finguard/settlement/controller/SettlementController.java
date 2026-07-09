package com.ps.finguard.settlement.controller;

import com.ps.finguard.security.AuthUtil;
import com.ps.finguard.settlement.dto.SettlementResponse;
import com.ps.finguard.settlement.service.SettlementService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Tag(name = "Settlements")
@RestController
@RequiredArgsConstructor
public class SettlementController {

    private final SettlementService settlementService;

    @PostMapping("/api/groups/{groupId}/settle")
    public ResponseEntity<List<SettlementResponse>> settle(@PathVariable UUID groupId) {
        return ResponseEntity.ok(settlementService.settle(AuthUtil.requireId(), groupId));
    }

    @GetMapping("/api/groups/{groupId}/settlements")
    public ResponseEntity<List<SettlementResponse>> history(@PathVariable UUID groupId) {
        return ResponseEntity.ok(settlementService.history(AuthUtil.requireId(), groupId));
    }

    @PostMapping("/api/settlements/{id}/confirm")
    public ResponseEntity<SettlementResponse> confirm(@PathVariable UUID id) {
        return ResponseEntity.ok(settlementService.confirm(AuthUtil.requireId(), id));
    }
}
