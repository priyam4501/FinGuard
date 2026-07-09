package com.ps.finguard.settlement.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "settlements")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SettlementEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "group_id", nullable = false, columnDefinition = "uuid")
    private UUID groupId;

    @Column(name = "from_user_id", nullable = false, columnDefinition = "uuid")
    private UUID fromUserId;

    @Column(name = "to_user_id", nullable = false, columnDefinition = "uuid")
    private UUID toUserId;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @Type(SettlementStatusType.class)
    @Column(nullable = false, columnDefinition = "settlement_status")
    private SettlementStatus status;

    @Column(name = "generated_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime generatedAt;

    @Column(name = "confirmed_at")
    private OffsetDateTime confirmedAt;
}
