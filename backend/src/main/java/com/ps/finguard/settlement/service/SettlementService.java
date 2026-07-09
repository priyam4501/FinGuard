package com.ps.finguard.settlement.service;

import com.ps.finguard.balance.dto.BalanceResponse;
import com.ps.finguard.balance.service.BalanceService;
import com.ps.finguard.common.AppException;
import com.ps.finguard.common.Money;
import com.ps.finguard.group.service.GroupService;
import com.ps.finguard.settlement.dto.SettlementResponse;
import com.ps.finguard.settlement.entity.SettlementEntity;
import com.ps.finguard.settlement.entity.SettlementStatus;
import com.ps.finguard.settlement.repository.SettlementRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.*;

/**
 * Debt-minimization settlement engine (Java port of the original TS engine).
 *
 * Correctness invariant: for a fully circular ledger (net_balance == 0 for every
 * member) the plan is empty — zero transactions.
 *
 * Idempotency: while any PENDING plan exists for the group, {@link #settle} returns
 * that existing plan unchanged instead of proposing a new one.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SettlementService {

    private final SettlementRepository settlementRepository;
    private final BalanceService balanceService;
    private final GroupService groupService;

    @Transactional
    public List<SettlementResponse> settle(UUID userId, UUID groupId) {
        groupService.requireMembership(groupId, userId);

        // Idempotency: reuse existing pending plan.
        List<SettlementEntity> existing = settlementRepository
                .findAllByGroupIdAndStatusOrderByGeneratedAtAsc(groupId, SettlementStatus.PENDING);
        if (!existing.isEmpty()) {
            return existing.stream().map(this::toResponse).toList();
        }

        List<BalanceResponse> balances = balanceService.getBalances(groupId);

        PriorityQueue<Node> creditors = new PriorityQueue<>((a, b) -> b.amount.compareTo(a.amount));
        PriorityQueue<Node> debtors   = new PriorityQueue<>((a, b) -> b.amount.compareTo(a.amount));

        for (BalanceResponse b : balances) {
            BigDecimal net = Money.scale(b.netBalance());
            if (Money.isZero(net)) continue;
            if (net.signum() > 0) creditors.add(new Node(b.userId(), net));
            else                  debtors.add(new Node(b.userId(), net.negate()));
        }

        List<SettlementEntity> plan = new ArrayList<>();
        while (!creditors.isEmpty() && !debtors.isEmpty()) {
            Node c = creditors.poll();
            Node d = debtors.poll();
            BigDecimal settle = c.amount.min(d.amount).setScale(2, RoundingMode.HALF_UP);
            if (settle.compareTo(Money.EPSILON) < 0) break;

            plan.add(SettlementEntity.builder()
                    .groupId(groupId)
                    .fromUserId(d.id)
                    .toUserId(c.id)
                    .amount(settle)
                    .status(SettlementStatus.PENDING)
                    .build());

            BigDecimal cRem = c.amount.subtract(settle).setScale(2, RoundingMode.HALF_UP);
            BigDecimal dRem = d.amount.subtract(settle).setScale(2, RoundingMode.HALF_UP);
            if (cRem.compareTo(Money.EPSILON) >= 0) creditors.add(new Node(c.id, cRem));
            if (dRem.compareTo(Money.EPSILON) >= 0) debtors.add(new Node(d.id, dRem));
        }

        if (plan.isEmpty()) return List.of();
        List<SettlementEntity> saved = settlementRepository.saveAll(plan);
        log.info("Settlement plan generated for group {}: {} transaction(s)", groupId, saved.size());
        return saved.stream().map(this::toResponse).toList();
    }

    @Transactional
    public SettlementResponse confirm(UUID userId, UUID settlementId) {
        SettlementEntity s = settlementRepository.findById(settlementId)
                .orElseThrow(() -> AppException.notFound("Settlement"));
        if (!s.getFromUserId().equals(userId) && !s.getToUserId().equals(userId)) {
            throw AppException.forbidden("Only the payer or receiver can confirm this settlement");
        }
        if (s.getStatus() == SettlementStatus.CONFIRMED) {
            return toResponse(s); // idempotent
        }
        s.setStatus(SettlementStatus.CONFIRMED);
        s.setConfirmedAt(OffsetDateTime.now());
        log.info("Settlement {} confirmed by {}", settlementId, userId);
        return toResponse(s);
    }

    @Transactional(readOnly = true)
    public List<SettlementResponse> history(UUID userId, UUID groupId) {
        groupService.requireMembership(groupId, userId);
        return settlementRepository.findAllByGroupIdOrderByGeneratedAtDesc(groupId)
                .stream().map(this::toResponse).toList();
    }

    private SettlementResponse toResponse(SettlementEntity s) {
        return new SettlementResponse(s.getId(), s.getGroupId(), s.getFromUserId(), s.getToUserId(),
                Money.scale(s.getAmount()), s.getStatus(), s.getGeneratedAt(), s.getConfirmedAt());
    }

    private static final class Node {
        final UUID id;
        final BigDecimal amount;
        Node(UUID id, BigDecimal amount) { this.id = id; this.amount = amount; }
    }
}
