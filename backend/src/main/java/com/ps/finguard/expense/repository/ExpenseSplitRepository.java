package com.ps.finguard.expense.repository;

import com.ps.finguard.expense.entity.ExpenseSplitEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ExpenseSplitRepository extends JpaRepository<ExpenseSplitEntity, UUID> {
    List<ExpenseSplitEntity> findAllByExpenseId(UUID expenseId);
    void deleteAllByExpenseId(UUID expenseId);
}
