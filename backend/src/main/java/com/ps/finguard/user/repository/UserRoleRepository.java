package com.ps.finguard.user.repository;

import com.ps.finguard.user.entity.AppRole;
import com.ps.finguard.user.entity.UserRoleEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface UserRoleRepository extends JpaRepository<UserRoleEntity, UUID> {
    List<UserRoleEntity> findAllByUserId(UUID userId);
    boolean existsByUserIdAndRole(UUID userId, AppRole role);
}
