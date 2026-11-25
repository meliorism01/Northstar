package com.ordexa.membership.entity;

import java.util.Set;

public enum MerchantRole {
    OWNER(5),
    ADMIN(4),
    MANAGER(3),
    OPERATOR(2),
    VIEWER(1);

    private final int rank;

    MerchantRole(int rank) {
        this.rank = rank;
    }

    public int getRank() {
        return rank;
    }

    public boolean hasAtLeast(MerchantRole minimumRole) {
        return this.rank >= minimumRole.rank;
    }

    public Set<String> grantedAuthorities() {
        return switch (this) {
            case OWNER -> Set.of(
                    "ROLE_OWNER",
                    "PERM_WORKSPACE_OWNER",
                    "PERM_WORKSPACE_ADMIN",
                    "PERM_WORKFLOW_MANAGE",
                    "PERM_OPERATIONS_WRITE",
                    "PERM_WORKSPACE_READ"
            );
            case ADMIN -> Set.of(
                    "ROLE_ADMIN",
                    "PERM_WORKSPACE_ADMIN",
                    "PERM_WORKFLOW_MANAGE",
                    "PERM_OPERATIONS_WRITE",
                    "PERM_WORKSPACE_READ"
            );
            case MANAGER -> Set.of(
                    "ROLE_MANAGER",
                    "PERM_WORKFLOW_MANAGE",
                    "PERM_OPERATIONS_WRITE",
                    "PERM_WORKSPACE_READ"
            );
            case OPERATOR -> Set.of(
                    "ROLE_OPERATOR",
                    "PERM_OPERATIONS_WRITE",
                    "PERM_WORKSPACE_READ"
            );
            case VIEWER -> Set.of(
                    "ROLE_VIEWER",
                    "PERM_WORKSPACE_READ"
            );
        };
    }
}
