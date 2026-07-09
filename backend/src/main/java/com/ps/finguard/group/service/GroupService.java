package com.ps.finguard.group.service;

import com.ps.finguard.common.AppException;
import com.ps.finguard.group.dto.*;
import com.ps.finguard.group.entity.GroupEntity;
import com.ps.finguard.group.entity.GroupMemberEntity;
import com.ps.finguard.group.entity.MemberRole;
import com.ps.finguard.group.mapper.GroupMapper;
import com.ps.finguard.group.repository.GroupMemberRepository;
import com.ps.finguard.group.repository.GroupRepository;
import com.ps.finguard.balance.service.BalanceService;
import com.ps.finguard.user.entity.UserEntity;
import com.ps.finguard.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class GroupService {

    private final GroupRepository groupRepository;
    private final GroupMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final BalanceService balanceService;
    private final GroupMapper groupMapper;

    @Transactional
    public GroupResponse create(UUID userId, CreateGroupRequest req) {
        String currency = req.currency() == null || req.currency().isBlank() ? "INR"
                : req.currency().trim().toUpperCase();
        GroupEntity group = GroupEntity.builder()
                .name(req.name().trim())
                .currency(currency)
                .createdBy(userId)
                .build();
        group = groupRepository.save(group);
        memberRepository.save(GroupMemberEntity.builder()
                .groupId(group.getId())
                .userId(userId)
                .role(MemberRole.OWNER)
                .build());
        log.info("Group {} created by {}", group.getId(), userId);
        return groupMapper.toResponse(group);
    }

    @Transactional(readOnly = true)
    public List<GroupSummaryResponse> listMyGroups(UUID userId) {
        List<GroupMemberEntity> memberships = memberRepository.findAllByUserId(userId);
        List<GroupSummaryResponse> out = new ArrayList<>();
        for (GroupMemberEntity m : memberships) {
            GroupEntity g = groupRepository.findById(m.getGroupId()).orElse(null);
            if (g == null) continue;
            long count = memberRepository.countByGroupId(g.getId());
            BigDecimal net = balanceService.getBalances(g.getId()).stream()
                    .filter(b -> b.userId().equals(userId))
                    .map(b -> b.netBalance())
                    .findFirst().orElse(BigDecimal.ZERO);
            out.add(new GroupSummaryResponse(g.getId(), g.getName(), g.getCurrency(),
                    g.getCreatedBy(), g.getCreatedAt(), count, net));
        }
        out.sort((a, b) -> b.createdAt().compareTo(a.createdAt()));
        return out;
    }

    @Transactional(readOnly = true)
    public GroupResponse get(UUID userId, UUID groupId) {
        requireMembership(groupId, userId);
        GroupEntity g = groupRepository.findById(groupId).orElseThrow(() -> AppException.notFound("Group"));
        return groupMapper.toResponse(g);
    }

    @Transactional(readOnly = true)
    public List<GroupMemberResponse> listMembers(UUID userId, UUID groupId) {
        requireMembership(groupId, userId);
        List<GroupMemberEntity> members = memberRepository.findAllByGroupId(groupId);
        List<UUID> ids = members.stream().map(GroupMemberEntity::getUserId).toList();
        Map<UUID, UserEntity> byId = new HashMap<>();
        for (UserEntity u : userRepository.findAllById(ids)) byId.put(u.getId(), u);
        return members.stream().map(m -> {
            UserEntity u = byId.get(m.getUserId());
            return new GroupMemberResponse(m.getUserId(), m.getRole(),
                    u == null ? "Unknown" : u.getFullName(),
                    u == null ? "" : u.getEmail());
        }).toList();
    }

    @Transactional
    public GroupResponse rename(UUID userId, UUID groupId, UpdateGroupRequest req) {
        requireOwner(groupId, userId);
        GroupEntity g = groupRepository.findById(groupId).orElseThrow(() -> AppException.notFound("Group"));
        g.setName(req.name().trim());
        return groupMapper.toResponse(g);
    }

    @Transactional
    public void delete(UUID userId, UUID groupId) {
        requireOwner(groupId, userId);
        groupRepository.deleteById(groupId);
        log.info("Group {} deleted by {}", groupId, userId);
    }

    public void requireMembership(UUID groupId, UUID userId) {
        if (!memberRepository.existsByGroupIdAndUserId(groupId, userId)) {
            throw AppException.forbidden("You are not a member of this group");
        }
    }

    public void requireOwner(UUID groupId, UUID userId) {
        if (!memberRepository.existsByGroupIdAndUserIdAndRole(groupId, userId, MemberRole.OWNER)) {
            throw AppException.forbidden("Only the group owner can perform this action");
        }
    }
}
