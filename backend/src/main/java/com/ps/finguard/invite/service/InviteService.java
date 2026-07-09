package com.ps.finguard.invite.service;

import com.ps.finguard.common.AppException;
import com.ps.finguard.group.entity.GroupEntity;
import com.ps.finguard.group.entity.GroupMemberEntity;
import com.ps.finguard.group.entity.MemberRole;
import com.ps.finguard.group.repository.GroupMemberRepository;
import com.ps.finguard.group.repository.GroupRepository;
import com.ps.finguard.group.service.GroupService;
import com.ps.finguard.invite.dto.CreateInviteRequest;
import com.ps.finguard.invite.dto.InviteResponse;
import com.ps.finguard.invite.entity.GroupInviteEntity;
import com.ps.finguard.invite.entity.InviteStatus;
import com.ps.finguard.invite.repository.GroupInviteRepository;
import com.ps.finguard.user.entity.UserEntity;
import com.ps.finguard.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class InviteService {

    private final GroupInviteRepository inviteRepository;
    private final GroupMemberRepository memberRepository;
    private final GroupRepository groupRepository;
    private final UserRepository userRepository;
    private final GroupService groupService;

    @Transactional
    public InviteResponse create(UUID actorId, UUID groupId, CreateInviteRequest req) {
        groupService.requireOwner(groupId, actorId);
        String email = req.email().trim().toLowerCase();

        // If the invited user already has an account and is already a member, short-circuit.
        Optional<UserEntity> existing = userRepository.findByEmailIgnoreCase(email);
        if (existing.isPresent() && memberRepository.existsByGroupIdAndUserId(groupId, existing.get().getId())) {
            throw AppException.conflict("This user is already a member");
        }
        GroupInviteEntity inv = GroupInviteEntity.builder()
                .groupId(groupId)
                .invitedEmail(email)
                .invitedBy(actorId)
                .status(InviteStatus.PENDING)
                .build();
        inv = inviteRepository.save(inv);
        log.info("Invite {} created for {} in group {}", inv.getId(), email, groupId);
        return toResponse(inv, groupName(groupId));
    }

    @Transactional
    public void addMemberDirect(UUID actorId, UUID groupId, String email) {
        groupService.requireOwner(groupId, actorId);
        UserEntity user = userRepository.findByEmailIgnoreCase(email.trim().toLowerCase())
                .orElseThrow(() -> AppException.notFound("User with that email"));
        if (memberRepository.existsByGroupIdAndUserId(groupId, user.getId())) {
            throw AppException.conflict("User is already a member");
        }
        memberRepository.save(GroupMemberEntity.builder()
                .groupId(groupId).userId(user.getId()).role(MemberRole.MEMBER).build());
    }

    @Transactional(readOnly = true)
    public List<InviteResponse> myPending(UUID userId) {
        UserEntity me = userRepository.findById(userId).orElseThrow(() -> AppException.notFound("User"));
        List<GroupInviteEntity> pending = inviteRepository.findMineByEmailAndStatus(me.getEmail(), InviteStatus.PENDING);
        // fetch group names in one pass
        Set<UUID> gids = new HashSet<>();
        for (GroupInviteEntity i : pending) gids.add(i.getGroupId());
        Map<UUID, String> nameById = new HashMap<>();
        for (GroupEntity g : groupRepository.findAllById(gids)) nameById.put(g.getId(), g.getName());
        return pending.stream().map(i -> toResponse(i, nameById.get(i.getGroupId()))).toList();
    }

    @Transactional(readOnly = true)
    public List<InviteResponse> groupPending(UUID actorId, UUID groupId) {
        groupService.requireOwner(groupId, actorId);
        String gname = groupName(groupId);
        return inviteRepository.findAllByGroupIdAndStatusOrderByCreatedAtDesc(groupId, InviteStatus.PENDING)
                .stream().map(i -> toResponse(i, gname)).toList();
    }

    @Transactional
    public UUID accept(UUID userId, UUID inviteId) {
        GroupInviteEntity inv = inviteRepository.findById(inviteId).orElseThrow(() -> AppException.notFound("Invite"));
        UserEntity me = userRepository.findById(userId).orElseThrow(() -> AppException.notFound("User"));
        if (!inv.getInvitedEmail().equalsIgnoreCase(me.getEmail())) {
            throw AppException.forbidden("This invite is not addressed to you");
        }
        if (inv.getStatus() != InviteStatus.PENDING) {
            throw AppException.conflict("Invite is already " + inv.getStatus());
        }
        if (!memberRepository.existsByGroupIdAndUserId(inv.getGroupId(), userId)) {
            memberRepository.save(GroupMemberEntity.builder()
                    .groupId(inv.getGroupId()).userId(userId).role(MemberRole.MEMBER).build());
        }
        inv.setStatus(InviteStatus.ACCEPTED);
        return inv.getGroupId();
    }

    @Transactional
    public void decline(UUID userId, UUID inviteId) {
        GroupInviteEntity inv = inviteRepository.findById(inviteId).orElseThrow(() -> AppException.notFound("Invite"));
        UserEntity me = userRepository.findById(userId).orElseThrow(() -> AppException.notFound("User"));
        if (!inv.getInvitedEmail().equalsIgnoreCase(me.getEmail())) {
            throw AppException.forbidden("This invite is not addressed to you");
        }
        if (inv.getStatus() != InviteStatus.PENDING) return;
        inv.setStatus(InviteStatus.DECLINED);
    }

    private String groupName(UUID groupId) {
        return groupRepository.findById(groupId).map(GroupEntity::getName).orElse(null);
    }

    private InviteResponse toResponse(GroupInviteEntity i, String groupName) {
        return new InviteResponse(i.getId(), i.getGroupId(), groupName,
                i.getInvitedEmail(), i.getStatus(), i.getCreatedAt());
    }
}
