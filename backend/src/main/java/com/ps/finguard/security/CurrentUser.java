package com.ps.finguard.security;

import java.util.List;
import java.util.UUID;

public record CurrentUser(UUID id, String email, List<String> roles) {
    public boolean hasRole(String role) {
        return roles != null && roles.contains(role);
    }
}
