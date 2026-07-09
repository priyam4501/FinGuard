package com.ps.finguard.settlement.repository;

import com.ps.finguard.settlement.entity.SettlementEntity;
import com.ps.finguard.settlement.entity.SettlementStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SettlementRepository extends JpaRepository<SettlementEntity, UUID> {
    List<SettlementEntity> findAllByGroupIdOrderByGeneratedAtDesc(UUID groupId);
    List<SettlementEntity> findAllByGroupIdAndStatusOrderByGeneratedAtAsc(UUID groupId, SettlementStatus status);
    Optional<SettlementEntity> findTopByGroupIdAndStatusOrderByConfirmedAtDesc(UUID groupId, SettlementStatus status);
}
