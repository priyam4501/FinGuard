package com.ps.finguard.group.entity;

import com.ps.finguard.common.PgEnumType;

public class MemberRoleType extends PgEnumType<MemberRole> {
    @Override
    protected Class<MemberRole> enumClass() { return MemberRole.class; }
}
