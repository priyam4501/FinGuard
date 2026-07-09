package com.ps.finguard.security;

import com.ps.finguard.common.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

public final class AuthUtil {
    private AuthUtil() {}

    public static CurrentUser require() {
        Object principal = SecurityContextHolder.getContext().getAuthentication() == null
                ? null
                : SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof CurrentUser cu)) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        return cu;
    }

    public static UUID requireId() {
        return require().id();
    }
}
