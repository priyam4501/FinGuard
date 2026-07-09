package com.ps.finguard.settlement.entity;

import com.ps.finguard.common.PgEnumType;

public class SettlementStatusType extends PgEnumType<SettlementStatus> {
    @Override
    protected Class<SettlementStatus> enumClass() { return SettlementStatus.class; }
}
