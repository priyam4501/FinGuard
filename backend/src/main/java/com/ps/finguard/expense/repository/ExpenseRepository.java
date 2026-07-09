package com.ps.finguard.expense.repository;

import com.ps.finguard.expense.entity.ExpenseEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ExpenseRepository extends JpaRepository<ExpenseEntity, UUID> {
    Page<ExpenseEntity> findAllByGroupId(UUID groupId, Pageable pageable);
    List<ExpenseEntity> findAllByGroupIdOrderByCreatedAtDesc(UUID groupId);
}
