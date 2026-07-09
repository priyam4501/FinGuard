package com.ps.finguard.user.entity;

import com.ps.finguard.common.PgEnumType;

public class AppRoleType extends PgEnumType<AppRole> {
    @Override
    protected Class<AppRole> enumClass() {
        return AppRole.class;
    }
}
