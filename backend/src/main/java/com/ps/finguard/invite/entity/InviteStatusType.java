package com.ps.finguard.invite.entity;

import com.ps.finguard.common.PgEnumType;

public class InviteStatusType extends PgEnumType<InviteStatus> {
    @Override
    protected Class<InviteStatus> enumClass() { return InviteStatus.class; }
}
