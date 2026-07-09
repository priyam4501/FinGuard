package com.ps.finguard.expense.entity;

import com.ps.finguard.common.PgEnumType;

public class SplitStrategyType extends PgEnumType<SplitStrategy> {
    @Override
    protected Class<SplitStrategy> enumClass() { return SplitStrategy.class; }
}
