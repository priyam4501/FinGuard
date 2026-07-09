package com.ps.finguard.invite.controller;

import com.ps.finguard.invite.dto.CreateInviteRequest;
import com.ps.finguard.invite.dto.InviteResponse;
import com.ps.finguard.invite.service.InviteService;
import com.ps.finguard.security.AuthUtil;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Tag(name = "Invites")
@RestController
@RequiredArgsConstructor
public class InviteController {

    private final InviteService inviteService;

    @PostMapping("/api/groups/{groupId}/invites")
    public ResponseEntity<InviteResponse> create(@PathVariable UUID groupId,
                                                 @Valid @RequestBody CreateInviteRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(inviteService.create(AuthUtil.requireId(), groupId, req));
    }

    @PostMapping("/api/groups/{groupId}/members")
    public ResponseEntity<Void> addExistingMember(@PathVariable UUID groupId,
                                                  @Valid @RequestBody CreateInviteRequest req) {
        inviteService.addMemberDirect(AuthUtil.requireId(), groupId, req.email());
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @GetMapping("/api/groups/{groupId}/invites")
    public ResponseEntity<List<InviteResponse>> groupPending(@PathVariable UUID groupId) {
        return ResponseEntity.ok(inviteService.groupPending(AuthUtil.requireId(), groupId));
    }

    @GetMapping("/api/invites")
    public ResponseEntity<List<InviteResponse>> myPending() {
        return ResponseEntity.ok(inviteService.myPending(AuthUtil.requireId()));
    }

    @PostMapping("/api/invites/{id}/accept")
    public ResponseEntity<Map<String, UUID>> accept(@PathVariable UUID id) {
        UUID gid = inviteService.accept(AuthUtil.requireId(), id);
        return ResponseEntity.ok(Map.of("groupId", gid));
    }

    @PostMapping("/api/invites/{id}/decline")
    public ResponseEntity<Void> decline(@PathVariable UUID id) {
        inviteService.decline(AuthUtil.requireId(), id);
        return ResponseEntity.noContent().build();
    }
}
