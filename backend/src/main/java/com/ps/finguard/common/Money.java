package com.ps.finguard.common;

import java.math.BigDecimal;
import java.math.RoundingMode;

public final class Money {
    public static final BigDecimal EPSILON = new BigDecimal("0.005");
    public static final int SCALE = 2;

    private Money() {}

    public static BigDecimal scale(BigDecimal v) {
        return v == null ? null : v.setScale(SCALE, RoundingMode.HALF_UP);
    }

    public static boolean isZero(BigDecimal v) {
        return v == null || v.abs().compareTo(EPSILON) < 0;
    }
}
