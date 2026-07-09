package com.ps.finguard.invite.repository;

import com.ps.finguard.invite.entity.GroupInviteEntity;
import com.ps.finguard.invite.entity.InviteStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface GroupInviteRepository extends JpaRepository<GroupInviteEntity, UUID> {

    @Query("select i from GroupInviteEntity i where lower(i.invitedEmail) = lower(:email) and i.status = :status " +
           "order by i.createdAt desc")
    List<GroupInviteEntity> findMineByEmailAndStatus(String email, InviteStatus status);

    List<GroupInviteEntity> findAllByGroupIdAndStatusOrderByCreatedAtDesc(UUID groupId, InviteStatus status);
}
