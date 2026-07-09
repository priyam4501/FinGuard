package com.ps.finguard.expense.entity;

import com.ps.finguard.common.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "expenses")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ExpenseEntity extends BaseEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "group_id", nullable = false, columnDefinition = "uuid")
    private UUID groupId;

    @Column(name = "payer_id", nullable = false, columnDefinition = "uuid")
    private UUID payerId;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false)
    private String description;

    @Type(SplitStrategyType.class)
    @Column(name = "split_strategy", nullable = false, columnDefinition = "split_strategy")
    private SplitStrategy splitStrategy;

    @Column(name = "created_by", nullable = false, columnDefinition = "uuid")
    private UUID createdBy;
}
