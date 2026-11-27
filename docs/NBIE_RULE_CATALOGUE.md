# NORTHSTAR — NBIE Rule Catalogue (`NBIE_RULESET_V1`)

All rules in `NBIE_RULESET_V1` are pure, deterministic, stateless, and independently unit-tested in `InterventionRuleEvaluator` + `InterventionFeasibilityService` + `InterventionEngineService`.

No LLM calls, probabilistic black-box scores, or uncalibrated "AI confidence" percentages are used.

---

## 1. Pre-Evaluation Lifecycle & Data-Freshness Guards

| Guard ID | Condition | Resulting `EvaluationStatus` | Intervention Emitted | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| `NBIE-POST-001` | `OrderStatus` in `('SHIPPED', 'DELIVERED')` (`DispatchLifecycleState.POST_DISPATCH`) | `NOT_APPLICABLE_POST_DISPATCH` | None (`[]`) | Pre-dispatch NBIE is out of scope once handed to courier; post-dispatch exceptions belong to NDR workflows. |
| `NBIE-POST-002` | `OrderStatus == 'CANCELLED'` | `NOT_APPLICABLE_CANCELLED` | None (`[]`) | Cancelled orders require no pre-dispatch intervention. |
| `NBIE-POLICY-001` | `policy.enabled == false` | `POLICY_DISABLED` | None (`[]`) | Honors merchant-level NBIE kill-switch. |
| `NBIE-RTO-001` | Existing 4-pillar `rtoSnapshot` is `null` or `band` is blank | `ASSESSMENT_UNAVAILABLE` | None (`[]`) | NBIE never fabricates a fallback risk score or risk band. |
| `NBIE-RTO-002` | `Duration.between(rtoSnapshot.assessedAt, evaluatedAt) > policy.maxRtoAssessmentAgeMinutes` (default `60` min) | `ASSESSMENT_STALE_REFRESH_REQUIRED` | None (`[]`) | Prevents acting on stale risk assessments. |
| `NBIE-COLD-001` | `priorOrderCount == 0` (`coldStartCustomer == true`) | Cold-start neutral | None (neutral guard) | First-time buyers have neutral history — never penalized with negative behavioural candidates or partial-advance prompts on cold-start status. |

---

## 2. Candidate Generation Rules (`NBIE_RULESET_V1`)

| Rule ID | Intervention Type | Trigger Conditions | Explicit Exclusions | Reason Codes Emitted | Priority | Proposed Channel | Automated Tests |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `NBIE-REVIEW-001` | `HUMAN_REVIEW` | `!conflictingEvidenceIndicators.isEmpty()` OR `codConfirmationStatus` in `('DENIED', 'CANCELLATION_REQUESTED')` OR `lastCallingOutcome == HUMAN_ESCALATION` OR `lastCallingOutcome == INVALID_NUMBER` OR (`paymentMethod == COD` AND `!phoneRoutable`) | Does not hold or cancel the order; routes evidence to operator. | `CONFLICTING_EVIDENCE`, `CALL_DENIED_ORDER`, `CALL_CANCELLATION_INTENT`, `CALL_REQUIRES_HUMAN_FOLLOWUP`, `UNREACHABLE_OR_INVALID_PHONE` | `HIGH` (always ranked `#1` ahead of contact candidates) | `INTERNAL_QUEUE` | `NbieRuleEngineAndFeasibilityUnitTest#conflictingEvidenceRoutesToHighPriorityHumanReviewRankedFirst` |
| `NBIE-ADDR-001` | `ADDRESS_CLARIFICATION` | `addressCompleteness` in `('INCOMPLETE', 'UNKNOWN')` OR `pinValidityState == INVALID` OR `landmarkPresence == MISSING` OR `rtoReasonCodes.contains('ADDRESS_INCOMPLETE')` | Suppressed if customer already denied/requested cancellation (`DENIED` / `CANCELLATION_REQUESTED`), if `ADDRESS_CLARIFICATION` already completed, or if consent/DNC/policy blocks contact. Requests **only** `missingAddressFields`. | `ADDRESS_INCOMPLETE`, `PIN_CODE_INVALID`, `PIN_CODE_MISSING`, `LANDMARK_MISSING` | `HIGH` if invalid/missing PIN, missing street, or `rtoBand == HIGH`; else `MEDIUM` | `VOICE_SANDBOX` | `NbieRuleEngineAndFeasibilityUnitTest#incompleteAddressRequestsOnlyMissingFields` |
| `NBIE-COD-001` | `COD_CONFIRMATION` | `paymentMethod == COD` AND (`codConfirmationStatus` in `('PENDING', 'UNKNOWN')` OR `callSignalStale`) AND `orderValue >= policy.codConfirmationMinOrderValue` | Excluded for prepaid orders, already-confirmed COD orders, or buyer denial/cancellation. Prior `NO_ANSWER` / `BUSY` / `CALL_FAILED` calls are treated as inconclusive (keep `PENDING`), never fraud or rejection. | `CONFIRMATION_PENDING`, `PRIOR_CALL_INCONCLUSIVE_UNANSWERED`, `PRIOR_CALL_TRANSPORT_FAILED_NEUTRAL`, `CALL_SIGNAL_STALE` | `HIGH` if `rtoBand == HIGH` or `orderValue >= partialAdvanceMinOrderValue`; else `MEDIUM` | `VOICE_SANDBOX` | `NbieRuleEngineAndFeasibilityUnitTest#pendingCodWithGrantedConsentRecommendsCodConfirmation`, `#unansweredBusyAndFailedCallsAreTreatedAsInconclusiveNotFraudOrRejection` |
| `NBIE-ADV-001` | `OPTIONAL_PARTIAL_ADVANCE` | `paymentMethod == COD` AND `paymentStatus == PENDING` AND `orderValue >= policy.partialAdvanceMinOrderValue` **AND** `!coldStartCustomer` **AND** at least one corroborating indicator (`priorCancelledBeforeDispatchCount >= 2`, `REPEATED_COD_REFUSAL`, `HISTORICAL_CONFIRMATION_FAILURE`, `priorCodSuccessRate < 50%`, or `HIGH` RTO band with both incomplete address and unconfirmed COD) | **High order value alone is never sufficient.** **Cold-start customers are excluded.** Filtered out unless **both** `policy.partialAdvanceEnabled == true` and `policy.partialAdvancePaymentCapable == true`. Voluntary option only; NBIE never collects payment. | `HIGH_VALUE_ORDER`, `REPEATED_COD_REFUSAL`, `HISTORICAL_CONFIRMATION_FAILURE`, `LOW_PRIOR_COD_DELIVERY_RATE` | `LOW` (secondary to confirmation / address clarification) | `VOICE_SANDBOX` | `NbieRuleEngineAndFeasibilityUnitTest#highOrderValueAloneNeverTriggersPartialAdvanceAndPolicyGateEnforced` |
| `NBIE-REVIEW-002` | `HUMAN_REVIEW` | Not already covered by `NBIE-REVIEW-001`, AND (`exhaustedCalls && codConfirmationPending` OR (`rtoBand == HIGH` && `unresolvedSignalCount >= 2`) OR (`rtoBand == HIGH` && no other candidate applies)) | High risk alone never declines an order; recommends operator review alongside or in absence of targeted outreach. | `HIGH_RTO_RISK_BAND`, `REPEATED_UNANSWERED_CALLS`, `REPEATED_COD_REFUSAL`, `HISTORICAL_CONFIRMATION_FAILURE`, `ADDRESS_INCOMPLETE`, `CONFIRMATION_PENDING` | `HIGH` when `rtoBand == HIGH`; else `MEDIUM` | `INTERNAL_QUEUE` | `NbieRuleEngineAndFeasibilityUnitTest#deduplicationAndIdempotencyFingerprintTrackRulesetAndMaterialChanges` |
| `NBIE-REVIEW-003` | `HUMAN_REVIEW` | Post-feasibility fallback: `>= 1` outbound contact candidate was generated for unresolved uncertainty, **all** contact candidates were dropped by consent/DNC/caps/channel filters, and `policy.humanReviewEnabled == true` | Does not contact the customer; alerts operator that uncertainty exists while customer outreach is blocked. | `CONTACT_SUPPRESSED_BY_POLICY_OR_CONSENT` + specific drop codes (`CONSENT_UNKNOWN_NOT_PERMITTED`, `CONSENT_DENIED`, `DNC_OPTED_OUT`, `ORDER_CONTACT_CAP_REACHED`, etc.) | `MEDIUM` | `INTERNAL_QUEUE` | `NbieRuleEngineAndFeasibilityUnitTest#unknownDeniedConsentDncAndContactCapsSuppressOutboundContactAndFallbackToHumanReview`, `NbieIntegrationAndSecurityTest` |
| `NBIE-NONE-001` | `NO_INTERVENTION` | Zero feasible actionable interventions remain (e.g., low risk + complete address + prepaid or confirmed COD) | Explicitly **not** an order approval (`approvalRequired = false`). | `NO_UNRESOLVED_PRE_DISPATCH_UNCERTAINTY`, `COLD_START_NEUTRAL` (if `priorOrderCount == 0`) | `NONE` | `NONE` | `NbieRuleEngineAndFeasibilityUnitTest#coldStartFirstTimeCustomerWithCompletePrepaidOrderGetsNoInterventionAndNoNegativePenalty` |

---

## 3. Feasibility Filter Codes (`InterventionFeasibilityService`)

| Drop Code | Meaning |
| :--- | :--- |
| `LIFECYCLE_NOT_PRE_DISPATCH` | Order moved out of pre-dispatch states (`CREATED`, `CONFIRMED`, `PROCESSING`). |
| `INTERVENTION_ALREADY_COMPLETED` | Same `InterventionType` already completed on this order. |
| `ACTIVE_DUPLICATE_INTERVENTION` | Same `InterventionType` already active/executing on this order. |
| `POLICY_DISABLED` / `*_POLICY_DISABLED` | Merchant disabled NBIE or disabled the specific `InterventionType`. |
| `PARTIAL_ADVANCE_PAYMENT_CAPABILITY_UNAVAILABLE` | Merchant has not enabled verified voluntary payment-link capability. |
| `DNC_OPTED_OUT` | Customer opted out (`customer_calling_preferences.opted_out = true`) or session marked DNC. |
| `CONSENT_DENIED` | Customer communication consent explicitly `DENIED`. |
| `CONSENT_UNKNOWN_NOT_PERMITTED` | Customer consent is `UNKNOWN` (unknown consent is never treated as permission). |
| `UNROUTABLE_PHONE_NUMBER` | Phone number failed E.164 routability check (`CallingDndPolicy`). |
| `CHANNEL_DISABLED_BY_MERCHANT_POLICY` | Proposed channel not in `intervention_policies.enabled_channels`. |
| `CHANNEL_NOT_PERMITTED_BY_CONSENT` | Proposed channel not in customer's permitted consent channels. |
| `VOICE_CALLING_CONFIGURATION_DISABLED` | Merchant `calling_configurations.enabled == false`. |
| `ORDER_CONTACT_CAP_REACHED` | `orderContactCount >= policy.maxContactsPerOrder`. |
| `CUSTOMER_24H_CONTACT_CAP_REACHED` | `customerContactCount24h >= policy.maxContactsPerCustomer24h`. |
| `CONTACT_COOLDOWN_ACTIVE` | Elapsed time since `lastContactAt` is below `policy.minHoursBetweenContacts`. |

---

## 4. Transparent Ranking Specification (`InterventionRankingService`)

1. **Deduplication:** Candidates with the same `InterventionType` are merged into one item, preserving the highest `InterventionPriority` and unioning `triggeredRuleIds`, `reasonCodes`, and `requiredEvidence`.
2. **Baseline Removal:** `NO_INTERVENTION` is dropped whenever at least one actionable candidate survives feasibility filtering.
3. **Deterministic Sort Keys:**
   - **Key 1 (Conflict/Denial Safety):** `HUMAN_REVIEW` triggered by `NBIE-REVIEW-001` ranks first (`1` vs `0`) so customers who denied or cancelled an order are not contacted automatically.
   - **Key 2 (Urgency Weight):** `HIGH (3)` > `MEDIUM (2)` > `LOW (1)` > `NONE (0)`.
   - **Key 3 (Least Friction / Directness):** `COD_CONFIRMATION (10)` < `ADDRESS_CLARIFICATION (15)` < `HUMAN_REVIEW (20)` < `OPTIONAL_PARTIAL_ADVANCE (30)` < `NO_INTERVENTION (99)`.
   - **Key 4 (Tie-Breaker):** `InterventionType.ordinal()`.
4. **Bounded Output:** Rank `#1` is tagged `PRIMARY`; ranks `#2` and `#3` (if present) are tagged `SECONDARY`. Maximum 3 items per recommendation.
