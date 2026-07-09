package com.ps.finguard.group.repository;

import com.ps.finguard.group.entity.GroupMemberEntity;
import com.ps.finguard.group.entity.MemberRole;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GroupMemberRepository extends JpaRepository<GroupMemberEntity, UUID> {
    List<GroupMemberEntity> findAllByGroupId(UUID groupId);
    List<GroupMemberEntity> findAllByUserId(UUID userId);
    Optional<GroupMemberEntity> findByGroupIdAndUserId(UUID groupId, UUID userId);
    boolean existsByGroupIdAndUserId(UUID groupId, UUID userId);
    boolean existsByGroupIdAndUserIdAndRole(UUID groupId, UUID userId, MemberRole role);
    long countByGroupId(UUID groupId);
}
