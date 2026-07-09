package com.ps.finguard.balance.service;

import com.ps.finguard.balance.dto.BalanceResponse;
import com.ps.finguard.common.Money;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Net balance for a member of a group:
 *   sum(paid on expenses)
 *   - sum(owed on expense_splits)
 *   + sum(confirmed settlements sent)
 *   - sum(confirmed settlements received)
 *
 * Pending settlements are deliberately excluded (they are a proposal, not a fact).
 * Every group member appears in the result, even with 0 balance.
 */
@Service
@RequiredArgsConstructor
public class BalanceService {

    @PersistenceContext
    private final EntityManager em;

    @Transactional(readOnly = true)
    public List<BalanceResponse> getBalances(UUID groupId) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
            WITH members AS (
              SELECT gm.user_id, u.full_name, u.email
                FROM group_members gm
                JOIN users u ON u.id = gm.user_id
               WHERE gm.group_id = :gid
            ),
            paid AS (
              SELECT payer_id AS user_id, COALESCE(SUM(amount), 0) AS total
                FROM expenses WHERE group_id = :gid GROUP BY payer_id
            ),
            owed AS (
              SELECT es.user_id, COALESCE(SUM(es.amount_owed), 0) AS total
                FROM expense_splits es
                JOIN expenses e ON e.id = es.expense_id
               WHERE e.group_id = :gid
               GROUP BY es.user_id
            ),
            sent AS (
              SELECT from_user_id AS user_id, COALESCE(SUM(amount), 0) AS total
                FROM settlements WHERE group_id = :gid AND status = 'CONFIRMED'
                GROUP BY from_user_id
            ),
            received AS (
              SELECT to_user_id AS user_id, COALESCE(SUM(amount), 0) AS total
                FROM settlements WHERE group_id = :gid AND status = 'CONFIRMED'
                GROUP BY to_user_id
            )
            SELECT m.user_id, m.full_name, m.email,
                   COALESCE(p.total, 0)  AS total_paid,
                   COALESCE(o.total, 0)  AS total_owed,
                   COALESCE(p.total, 0) - COALESCE(o.total, 0)
                     + COALESCE(s.total, 0) - COALESCE(r.total, 0) AS net_balance
              FROM members m
              LEFT JOIN paid p     ON p.user_id = m.user_id
              LEFT JOIN owed o     ON o.user_id = m.user_id
              LEFT JOIN sent s     ON s.user_id = m.user_id
              LEFT JOIN received r ON r.user_id = m.user_id
        """).setParameter("gid", groupId).getResultList();

        List<BalanceResponse> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) {
            out.add(new BalanceResponse(
                    (UUID) r[0],
                    (String) r[1],
                    (String) r[2],
                    Money.scale((BigDecimal) r[3]),
                    Money.scale((BigDecimal) r[4]),
                    Money.scale((BigDecimal) r[5])
            ));
        }
        return out;
    }
}
