package com.ordexa.intervention.model;

public final class InterventionEnums {

    private InterventionEnums() {
    }

    public enum InterventionItemRole {
        PRIMARY,
        SECONDARY
    }

    public enum EvidenceCompleteness {
        HIGH,
        MEDIUM,
        LOW,
        INSUFFICIENT
    }

    public enum DispatchLifecycleState {
        PRE_DISPATCH,
        POST_DISPATCH,
        CANCELLED
    }

    public enum ConsentStatus {
        GRANTED,
        DENIED,
        UNKNOWN;

        /**
         * Unknown consent is NEVER permission to contact.
         */
        public boolean permitsOutboundContact() {
            return this == GRANTED;
        }
    }

    public enum PinValidityState {
        VALID,
        INVALID,
        UNKNOWN
    }

    public enum LandmarkPresence {
        PRESENT,
        MISSING,
        UNKNOWN
    }

    public enum AddressCompletenessState {
        COMPLETE,
        INCOMPLETE,
        UNKNOWN
    }

    public enum CodConfirmationStatus {
        PENDING,
        CONFIRMED,
        DENIED,
        CANCELLATION_REQUESTED,
        NOT_APPLICABLE,
        UNKNOWN
    }

    public enum InterventionChannel {
        VOICE_SANDBOX,
        INTERNAL_QUEUE,
        NONE
    }

    public enum ApprovalDecision {
        ACTION_APPROVED,
        ACTION_REJECTED
    }

    public enum ExecutionProviderMode {
        SANDBOX,
        DRY_RUN,
        INTERNAL
    }

    public enum ExecutionLogStatus {
        ACCEPTED_SANDBOX,
        SKIPPED_DUPLICATE,
        BLOCKED_POLICY,
        BLOCKED_CONSENT,
        FAILED
    }

    public enum InterventionOutcomeType {
        CUSTOMER_CONFIRMED_INTENT(true),
        CUSTOMER_DENIED_ORDER(true),
        CUSTOMER_REQUESTED_CANCELLATION(true),
        ADDRESS_DETAILS_PROVIDED(true),
        PARTIAL_ADVANCE_VOLUNTARILY_PAID(true),
        PARTIAL_ADVANCE_DECLINED(true),
        NO_ANSWER_INCONCLUSIVE(false),
        BUSY_INCONCLUSIVE(false),
        CONTACT_DELIVERY_FAILED(false),
        HUMAN_REVIEW_RESOLVED(true),
        HUMAN_REVIEW_UNRESOLVED(false);

        private final boolean verifiedResponse;

        InterventionOutcomeType(boolean verifiedResponse) {
            this.verifiedResponse = verifiedResponse;
        }

        public boolean isVerifiedResponse() {
            return verifiedResponse;
        }
    }
}
