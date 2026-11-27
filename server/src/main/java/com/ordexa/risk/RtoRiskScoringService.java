package com.ordexa.risk;

import com.ordexa.calling.entity.CallOutcome;
import com.ordexa.calling.entity.CallSession;
import com.ordexa.calling.entity.CallSessionStatus;
import com.ordexa.calling.repository.CallSessionRepository;
import com.ordexa.customer.entity.Customer;
import com.ordexa.order.entity.Order;
import com.ordexa.order.entity.OrderStatus;
import com.ordexa.order.entity.PaymentMethod;
import com.ordexa.order.repository.OrderRepository;
import com.ordexa.risk.RtoRiskAssessmentDto.RiskFactorReasonDto;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Four-pillar deterministic, explainable RTO Risk Intelligence Engine.
 *
 * Pillars:
 *   1. Existing Behavioural Risk (customer history, repeat deliveries vs cancellations)
 *   2. Order-Related Risk (COD vs prepaid, order value exposure, shipping address completeness)
 *   3. Calling Outcome Signal (AI COD call confirmation, denial, cancellation intent, or unanswered state)
 *   4. Historical Customer Confirmation Behaviour (past COD call confirmations vs denials)
 *
 * IMPORTANT: RTO risk is NEVER used to suppress initial COD verification calls.
 */
@Service
public class RtoRiskScoringService {

    private static final BigDecimal HIGH_VALUE_THRESHOLD = new BigDecimal("2500.00");
    private static final BigDecimal CONFIRM_THRESHOLD = new BigDecimal("1000.00");

    private final OrderRepository orderRepository;
    private final CallSessionRepository callSessionRepository;

    public RtoRiskScoringService(
            OrderRepository orderRepository,
            CallSessionRepository callSessionRepository) {
        this.orderRepository = orderRepository;
        this.callSessionRepository = callSessionRepository;
    }

    @Transactional(readOnly = true)
    public RtoRiskAssessmentDto assessOrder(Order order, Customer customer, CallSession activeCallSession) {
        UUID merchantId = order.getMerchantId();
        List<Order> customerOrders = orderRepository
                .findByMerchantIdAndCustomerIdOrderByCreatedAtDesc(merchantId, customer.getId());
        List<CallSession> historicalSessions = callSessionRepository
                .findByMerchantIdAndCustomer_IdOrderByCreatedAtDesc(merchantId, customer.getId());

        return computeAssessment(order, customer, customerOrders, activeCallSession, historicalSessions);
    }

    public RtoRiskAssessmentDto computeAssessment(
            Order order,
            Customer customer,
            List<Order> customerOrders,
            CallSession currentCallSession,
            List<CallSession> customerCallHistory) {

        List<RiskFactorReasonDto> reasons = new ArrayList<>();
        int behaviouralPoints = 0;
        int orderPoints = 0;
        int callingPoints = 0;
        int historicalCallPoints = 0;

        boolean isCod = order.getPaymentMethod() == PaymentMethod.COD;

        // ── Pillar 1: Existing Behavioural Risk ─────────────────────────────
        long cancelledCount = customerOrders.stream()
                .filter(o -> !o.getId().equals(order.getId()))
                .filter(o -> o.getOrderStatus() == OrderStatus.CANCELLED)
                .count();
        long deliveredCount = customerOrders.stream()
                .filter(o -> !o.getId().equals(order.getId()))
                .filter(o -> o.getOrderStatus() == OrderStatus.DELIVERED)
                .count();
        int totalOrders = Math.max(1, customer.getTotalOrders());

        if (cancelledCount >= 2) {
            behaviouralPoints += 45;
            reasons.add(new RiskFactorReasonDto(
                    "REPEATED_COD_REFUSAL",
                    "BEHAVIOURAL",
                    45,
                    "Repeated Cancellation / Refusal History",
                    "Customer has " + cancelledCount + " prior cancelled orders in this merchant workspace."));
        } else if (cancelledCount == 1) {
            behaviouralPoints += 24;
            reasons.add(new RiskFactorReasonDto(
                    "PRIOR_DELIVERY_EXCEPTION",
                    "BEHAVIOURAL",
                    24,
                    "Prior Order Cancellation",
                    "Customer has 1 prior cancelled order recorded in this store."));
        }

        if (totalOrders <= 1 && deliveredCount == 0 && isCod) {
            behaviouralPoints += 12;
            reasons.add(new RiskFactorReasonDto(
                    "NEW_CUSTOMER",
                    "BEHAVIOURAL",
                    12,
                    "First-Time COD Buyer",
                    "No prior completed delivery history in this merchant workspace yet."));
        }

        if (deliveredCount >= 2 && cancelledCount == 0) {
            behaviouralPoints -= 25;
            reasons.add(new RiskFactorReasonDto(
                    "VERIFIED_RETURNING_BUYER",
                    "BEHAVIOURAL",
                    -25,
                    "Reliable Returning Buyer",
                    "Customer has " + deliveredCount + " completed deliveries with zero cancellations."));
        }

        // ── Pillar 2: Order-Related Risk ────────────────────────────────────
        String addr = order.getShippingAddress() != null ? order.getShippingAddress().trim() : "";
        String lowerAddr = addr.toLowerCase(Locale.ROOT);
        boolean hasDetailMarker = lowerAddr.contains("near")
                || lowerAddr.contains("flat")
                || lowerAddr.contains("house")
                || lowerAddr.contains("sector")
                || lowerAddr.contains("road")
                || lowerAddr.contains("street")
                || lowerAddr.contains("nagar")
                || lowerAddr.contains("block")
                || addr.length() >= 28;
        if (addr.length() < 16 || !hasDetailMarker) {
            orderPoints += 30;
            reasons.add(new RiskFactorReasonDto(
                    "ADDRESS_INCOMPLETE",
                    "ORDER",
                    30,
                    "Incomplete Address / Missing Landmark",
                    "Shipping address appears short or lacks street/building/landmark specificity."));
        }

        boolean callConfirmed = currentCallSession != null
                && currentCallSession.getFinalOutcome() == CallOutcome.CONFIRMED;

        if (isCod && !callConfirmed
                && order.getOrderStatus() == OrderStatus.CREATED
                && order.getTotalAmount().compareTo(CONFIRM_THRESHOLD) >= 0) {
            orderPoints += 22;
            reasons.add(new RiskFactorReasonDto(
                    "CONFIRMATION_PENDING",
                    "ORDER",
                    22,
                    "Unverified COD Intent",
                    "Cash-on-Delivery order above INR 1,000 has not yet received explicit buyer confirmation."));
        }

        if (isCod && order.getTotalAmount().compareTo(HIGH_VALUE_THRESHOLD) >= 0) {
            orderPoints += 28;
            reasons.add(new RiskFactorReasonDto(
                    "HIGH_VALUE_ORDER",
                    "ORDER",
                    28,
                    "High-Value COD Exposure",
                    "COD order value (" + order.getTotalAmount() + " " + order.getCurrency()
                            + ") exceeds merchant high-value threshold."));
        }

        if (!isCod) {
            orderPoints -= 30;
            reasons.add(new RiskFactorReasonDto(
                    "PREPAID_ORDER_DISCOUNT",
                    "ORDER",
                    -30,
                    "Prepaid Order",
                    "Prepaid payment method carries substantially lower doorstep refusal risk."));
        }

        // ── Pillar 3: Calling Outcome Signal ────────────────────────────────
        CallOutcome outcome = currentCallSession != null ? currentCallSession.getFinalOutcome() : null;
        if (outcome != null) {
            switch (outcome) {
                case CONFIRMED -> {
                    callingPoints -= 18;
                    reasons.add(new RiskFactorReasonDto(
                            "CALL_CONFIRMED_INTENT",
                            "CALLING_OUTCOME",
                            -18,
                            "AI Call Confirmed by Buyer",
                            "Customer explicitly confirmed order items, address, and COD readiness on voice call."));
                }
                case REJECTED -> {
                    callingPoints += 55;
                    reasons.add(new RiskFactorReasonDto(
                            "CALL_DENIED_ORDER",
                            "CALLING_OUTCOME",
                            55,
                            "Buyer Denied Placing Order",
                            "Customer explicitly denied placing this order during AI verification call; hold dispatch for review."));
                }
                case CANCELLATION_REQUESTED -> {
                    callingPoints += 40;
                    reasons.add(new RiskFactorReasonDto(
                            "CALL_CANCELLATION_INTENT",
                            "CALLING_OUTCOME",
                            40,
                            "Cancellation Requested on Call",
                            "Customer asked to cancel the order during the verification call; do not dispatch."));
                }
                case INVALID_NUMBER -> {
                    callingPoints += 35;
                    reasons.add(new RiskFactorReasonDto(
                            "CALL_INVALID_PHONE_NUMBER",
                            "CALLING_OUTCOME",
                            35,
                            "Invalid / Unreachable Phone Number",
                            "Phone number failed carrier/E.164 validation; courier delivery is likely to fail without correction."));
                }
                case HUMAN_ESCALATION, UNCERTAIN -> {
                    callingPoints += 12;
                    reasons.add(new RiskFactorReasonDto(
                            "CALL_REQUIRES_HUMAN_FOLLOWUP",
                            "CALLING_OUTCOME",
                            12,
                            "Requires Human Specialist Follow-Up",
                            "Call ended inconclusively or customer requested a live support specialist."));
                }
                case NO_ANSWER, BUSY -> {
                    boolean exhausted = currentCallSession.getStatus() == CallSessionStatus.COMPLETED
                            && currentCallSession.getAttemptCount() >= currentCallSession.getMaxAttempts();
                    if (exhausted) {
                        callingPoints += 15;
                        reasons.add(new RiskFactorReasonDto(
                                "REPEATED_UNANSWERED_CALLS",
                                "CALLING_OUTCOME",
                                15,
                                "All Verification Call Attempts Unanswered",
                                "Customer did not answer across " + currentCallSession.getAttemptCount()
                                        + " attempts (review signal only — not proof of fraud)."));
                    } else {
                        reasons.add(new RiskFactorReasonDto(
                                "CALL_UNANSWERED_NEUTRAL",
                                "CALLING_OUTCOME",
                                0,
                                "Call Unanswered (Neutral Signal)",
                                "Unanswered call is treated as inconclusive; automatic retry scheduled."));
                    }
                }
                case CALL_FAILED -> reasons.add(new RiskFactorReasonDto(
                        "CALL_PROVIDER_FAILED_NEUTRAL",
                        "CALLING_OUTCOME",
                        0,
                        "Telephony Attempt Failed (Neutral)",
                        "Provider transport failure does not penalize customer risk score."));
            }
        }

        // ── Pillar 4: Historical Customer Confirmation Behaviour ────────────
        if (customerCallHistory != null && !customerCallHistory.isEmpty()) {
            UUID currentSessionId = currentCallSession != null ? currentCallSession.getId() : null;
            long priorConfirmedCalls = customerCallHistory.stream()
                    .filter(cs -> !cs.getId().equals(currentSessionId))
                    .filter(cs -> cs.getFinalOutcome() == CallOutcome.CONFIRMED)
                    .count();
            long priorNegativeCalls = customerCallHistory.stream()
                    .filter(cs -> !cs.getId().equals(currentSessionId))
                    .filter(cs -> cs.getFinalOutcome() == CallOutcome.REJECTED
                            || cs.getFinalOutcome() == CallOutcome.CANCELLATION_REQUESTED)
                    .count();

            if (priorConfirmedCalls >= 2 && priorNegativeCalls == 0) {
                historicalCallPoints -= 12;
                reasons.add(new RiskFactorReasonDto(
                        "HISTORICAL_CALL_RELIABLE",
                        "HISTORICAL_CONFIRMATION",
                        -12,
                        "Consistent Historical Voice Confirmations",
                        "Customer previously confirmed " + priorConfirmedCalls + " COD calls with zero denials."));
            } else if (priorNegativeCalls >= 2) {
                historicalCallPoints += 18;
                reasons.add(new RiskFactorReasonDto(
                        "HISTORICAL_CONFIRMATION_FAILURE",
                        "HISTORICAL_CONFIRMATION",
                        18,
                        "Repeated Historical Call Denials/Cancellations",
                        "Customer rejected or cancelled " + priorNegativeCalls + " prior COD verification calls."));
            }
        }

        int rawTotal = behaviouralPoints + orderPoints + callingPoints + historicalCallPoints;
        int totalScore = Math.max(0, Math.min(100, rawTotal));

        String band;
        if (totalScore >= 55) {
            band = "HIGH";
        } else if (totalScore >= 25) {
            band = "MEDIUM";
        } else {
            band = "LOW";
        }

        String recommendedAction = deriveRecommendedAction(outcome, band, isCod);
        List<String> reasonCodes = reasons.stream().map(RiskFactorReasonDto::code).toList();

        return new RtoRiskAssessmentDto(
                totalScore,
                band,
                behaviouralPoints,
                orderPoints,
                callingPoints,
                historicalCallPoints,
                reasonCodes,
                reasons,
                recommendedAction);
    }

    private String deriveRecommendedAction(CallOutcome outcome, String band, boolean isCod) {
        if (outcome == CallOutcome.CONFIRMED) {
            return "Clear for Dispatch — Buyer confirmed COD order on AI voice call.";
        }
        if (outcome == CallOutcome.REJECTED) {
            return "Hold Dispatch Immediately — Buyer denied placing this order; investigate or cancel.";
        }
        if (outcome == CallOutcome.CANCELLATION_REQUESTED) {
            return "Cancel Order Pre-Dispatch — Buyer explicitly requested cancellation; avoid forward freight.";
        }
        if (outcome == CallOutcome.INVALID_NUMBER) {
            return "Hold & Request Valid Phone — Contact buyer via email/WhatsApp to correct phone number.";
        }
        if (outcome == CallOutcome.HUMAN_ESCALATION) {
            return "Assign to Support Agent — Buyer requested human callback before dispatch.";
        }
        if (!isCod) {
            return "Approve for Dispatch — Prepaid order.";
        }
        if ("HIGH".equals(band)) {
            return "Await AI Call Verification or Manual Ops Review before courier manifest.";
        }
        if ("MEDIUM".equals(band)) {
            return "Await AI Call Verification; request landmark clarification if address is brief.";
        }
        return "Await Routine AI COD Verification Call (all COD orders verified regardless of risk).";
    }
}
