package com.ps.finguard.group.controller;

import com.ps.finguard.balance.dto.BalanceResponse;
import com.ps.finguard.balance.service.BalanceService;
import com.ps.finguard.group.dto.*;
import com.ps.finguard.group.service.GroupService;
import com.ps.finguard.security.AuthUtil;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Tag(name = "Groups")
@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;
    private final BalanceService balanceService;

    @GetMapping
    public ResponseEntity<List<GroupSummaryResponse>> myGroups() {
        return ResponseEntity.ok(groupService.listMyGroups(AuthUtil.requireId()));
    }

    @PostMapping
    public ResponseEntity<GroupResponse> create(@Valid @RequestBody CreateGroupRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(groupService.create(AuthUtil.requireId(), req));
    }

    @GetMapping("/{id}")
    public ResponseEntity<GroupResponse> get(@PathVariable UUID id) {
        return ResponseEntity.ok(groupService.get(AuthUtil.requireId(), id));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<GroupResponse> rename(@PathVariable UUID id, @Valid @RequestBody UpdateGroupRequest req) {
        return ResponseEntity.ok(groupService.rename(AuthUtil.requireId(), id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        groupService.delete(AuthUtil.requireId(), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/members")
    public ResponseEntity<List<GroupMemberResponse>> members(@PathVariable UUID id) {
        return ResponseEntity.ok(groupService.listMembers(AuthUtil.requireId(), id));
    }

    @GetMapping("/{id}/balances")
    public ResponseEntity<List<BalanceResponse>> balances(@PathVariable UUID id) {
        groupService.requireMembership(id, AuthUtil.requireId());
        return ResponseEntity.ok(balanceService.getBalances(id));
    }
}
