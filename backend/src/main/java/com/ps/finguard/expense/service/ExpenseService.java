package com.ps.finguard.expense.service;

import com.ps.finguard.common.AppException;
import com.ps.finguard.common.Money;
import com.ps.finguard.expense.dto.ExpenseResponse;
import com.ps.finguard.expense.dto.ExpenseWriteRequest;
import com.ps.finguard.expense.entity.ExpenseEntity;
import com.ps.finguard.expense.entity.ExpenseSplitEntity;
import com.ps.finguard.expense.entity.SplitStrategy;
import com.ps.finguard.expense.repository.ExpenseRepository;
import com.ps.finguard.expense.repository.ExpenseSplitRepository;
import com.ps.finguard.group.entity.MemberRole;
import com.ps.finguard.group.repository.GroupMemberRepository;
import com.ps.finguard.group.service.GroupService;
import com.ps.finguard.settlement.entity.SettlementStatus;
import com.ps.finguard.settlement.repository.SettlementRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final ExpenseSplitRepository splitRepository;
    private final GroupMemberRepository memberRepository;
    private final GroupService groupService;
    private final SettlementRepository settlementRepository;

    @PersistenceContext
    private final EntityManager em;

    @Transactional(readOnly = true)
    public List<ExpenseResponse> list(UUID userId, UUID groupId) {
        groupService.requireMembership(groupId, userId);
        List<ExpenseEntity> expenses = expenseRepository.findAllByGroupIdOrderByCreatedAtDesc(groupId);
        OffsetDateTime lastConfirmed = latestConfirmedAt(groupId);

        // Fetch splits per expense (small groups; single-round trip if needed)
        List<ExpenseResponse> out = new ArrayList<>(expenses.size());
        for (ExpenseEntity e : expenses) {
            List<ExpenseResponse.Split> splits = splitRepository.findAllByExpenseId(e.getId()).stream()
                    .map(s -> new ExpenseResponse.Split(s.getUserId(), Money.scale(s.getAmountOwed())))
                    .toList();
            boolean editable = lastConfirmed == null || e.getCreatedAt().isAfter(lastConfirmed);
            out.add(toResponse(e, splits, editable));
        }
        return out;
    }

    @Transactional
    public ExpenseResponse create(UUID userId, UUID groupId, ExpenseWriteRequest req) {
        groupService.requireMembership(groupId, userId);
        validateMembers(groupId, req);
        validateSplitsSum(req);

        ExpenseEntity expense = ExpenseEntity.builder()
                .groupId(groupId)
                .payerId(req.payerId())
                .amount(Money.scale(req.amount()))
                .description(req.description().trim())
                .splitStrategy(req.strategy())
                .createdBy(userId)
                .build();

        ExpenseEntity savedExpense = expenseRepository.save(expense);
        em.flush(); // Ensure parent row exists before trigger evaluates on splits

        UUID expenseId = savedExpense.getId();

        List<ExpenseSplitEntity> splits = req.splits().stream()
                .map(s -> ExpenseSplitEntity.builder()
                        .expenseId(expenseId)
                        .userId(s.userId())
                        .amountOwed(Money.scale(s.amountOwed()))
                        .build())
                .toList();

        splitRepository.saveAll(splits);

        log.info("Expense {} created in group {}", expenseId, groupId);

        List<ExpenseResponse.Split> splitDto = splits.stream()
                .map(s -> new ExpenseResponse.Split(
                        s.getUserId(),
                        Money.scale(s.getAmountOwed())
                ))
                .toList();

        return toResponse(savedExpense, splitDto, true);
    }

    @Transactional
    public ExpenseResponse update(UUID userId, UUID expenseId, ExpenseWriteRequest req) {
        ExpenseEntity e = expenseRepository.findById(expenseId)
                .orElseThrow(() -> AppException.notFound("Expense"));
        requireCanModify(userId, e);
        requireEditable(e);
        validateMembers(e.getGroupId(), req);
        validateSplitsSum(req);

        e.setPayerId(req.payerId());
        e.setAmount(Money.scale(req.amount()));
        e.setDescription(req.description().trim());
        e.setSplitStrategy(req.strategy());
        // Rewrite splits inside one txn; deferred sum-check trigger fires at commit.
        splitRepository.deleteAllByExpenseId(expenseId);
        em.flush();
        List<ExpenseSplitEntity> splits = req.splits().stream().map(s ->
                ExpenseSplitEntity.builder()
                        .expenseId(expenseId)
                        .userId(s.userId())
                        .amountOwed(Money.scale(s.amountOwed()))
                        .build()
        ).toList();
        splitRepository.saveAll(splits);
        log.info("Expense {} updated by {}", expenseId, userId);

        List<ExpenseResponse.Split> splitDto = splits.stream()
                .map(s -> new ExpenseResponse.Split(s.getUserId(), s.getAmountOwed())).toList();
        return toResponse(e, splitDto, true);
    }

    @Transactional
    public void delete(UUID userId, UUID expenseId) {
        ExpenseEntity e = expenseRepository.findById(expenseId)
                .orElseThrow(() -> AppException.notFound("Expense"));
        requireCanModify(userId, e);
        requireEditable(e);
        expenseRepository.deleteById(expenseId);
        log.info("Expense {} deleted by {}", expenseId, userId);
    }

    /* --- helpers --- */

    private void requireCanModify(UUID userId, ExpenseEntity e) {
        boolean owner = memberRepository.existsByGroupIdAndUserIdAndRole(e.getGroupId(), userId, MemberRole.OWNER);
        if (!owner && !e.getCreatedBy().equals(userId)) {
            throw AppException.forbidden("Only the creator or group owner can modify this expense");
        }
    }

    private void requireEditable(ExpenseEntity e) {
        OffsetDateTime last = latestConfirmedAt(e.getGroupId());
        if (last != null && !e.getCreatedAt().isAfter(last)) {
            throw AppException.forbidden("Expense is locked: a settlement was confirmed after it was created");
        }
    }

    private OffsetDateTime latestConfirmedAt(UUID groupId) {
        return settlementRepository.findTopByGroupIdAndStatusOrderByConfirmedAtDesc(groupId, SettlementStatus.CONFIRMED)
                .map(s -> s.getConfirmedAt()).orElse(null);
    }

    private void validateMembers(UUID groupId, ExpenseWriteRequest req) {
        Set<UUID> memberIds = new HashSet<>();
        memberRepository.findAllByGroupId(groupId).forEach(m -> memberIds.add(m.getUserId()));
        if (!memberIds.contains(req.payerId())) {
            throw AppException.badRequest("Payer is not a member of this group");
        }
        for (var s : req.splits()) {
            if (!memberIds.contains(s.userId())) {
                throw AppException.badRequest("Split target is not a member of this group");
            }
        }
    }

    private void validateSplitsSum(ExpenseWriteRequest req) {
        BigDecimal total = req.splits().stream().map(s -> Money.scale(s.amountOwed()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal amount = Money.scale(req.amount());
        if (total.compareTo(amount) != 0) {
            throw AppException.badRequest("Splits must sum to the expense amount (" + amount + "), got " + total);
        }
        if (req.strategy() == SplitStrategy.CUSTOM_PERCENTAGE && req.splits().isEmpty()) {
            throw AppException.badRequest("At least one split required");
        }
    }

    private ExpenseResponse toResponse(ExpenseEntity e, List<ExpenseResponse.Split> splits, boolean editable) {
        return new ExpenseResponse(
                e.getId(), e.getGroupId(), e.getPayerId(),
                Money.scale(e.getAmount()), e.getDescription(),
                e.getSplitStrategy(), e.getCreatedBy(), e.getCreatedAt(),
                editable, splits);
    }
}
