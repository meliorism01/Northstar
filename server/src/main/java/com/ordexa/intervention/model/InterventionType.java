package com.ordexa.intervention.model;

/**
 * Strictly bounded pre-dispatch intervention catalogue.
 *
 * CRITICAL AUTHORITY BOUNDARY:
 * NBIE recommends uncertainty-resolving interventions ONLY.
 * Order-level decision types (APPROVE_ORDER, DECLINE_ORDER, CANCEL_ORDER,
 * DISPATCH_HOLD, RELEASE_FOR_DISPATCH) are intentionally excluded and forbidden.
 */
public enum InterventionType {
    COD_CONFIRMATION(true, 10),
    ADDRESS_CLARIFICATION(true, 15),
    HUMAN_REVIEW(false, 20),
    OPTIONAL_PARTIAL_ADVANCE(true, 30),
    NO_INTERVENTION(false, 99);

    private final boolean requiresCustomerContact;
    private final int frictionRank;

    InterventionType(boolean requiresCustomerContact, int frictionRank) {
        this.requiresCustomerContact = requiresCustomerContact;
        this.frictionRank = frictionRank;
    }

    public boolean requiresCustomerContact() {
        return requiresCustomerContact;
    }

    public int frictionRank() {
        return frictionRank;
    }
}
