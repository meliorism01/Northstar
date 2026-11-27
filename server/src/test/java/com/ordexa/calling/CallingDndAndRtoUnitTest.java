package com.ordexa.calling;

import static org.assertj.core.api.Assertions.assertThat;

import com.ordexa.calling.config.CallingProperties;
import com.ordexa.calling.entity.CallOutcome;
import com.ordexa.calling.entity.CallSession;
import com.ordexa.calling.entity.CallSessionStatus;
import com.ordexa.calling.integration.WebhookSignatureVerifier;
import com.ordexa.calling.service.CallingDndPolicy;
import com.ordexa.customer.entity.Customer;
import com.ordexa.order.entity.Order;
import com.ordexa.order.entity.OrderSource;
import com.ordexa.order.entity.OrderStatus;
import com.ordexa.order.entity.PaymentMethod;
import com.ordexa.order.entity.PaymentStatus;
import com.ordexa.risk.RtoRiskAssessmentDto;
import com.ordexa.risk.RtoRiskScoringService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CallingDndAndRtoUnitTest {

    @Test
    void traiDndPolicyDefersNighttimeCallsToNextMorning0905IstAndLeavesDaytimeUnchanged() {
        // 17:00 UTC = 22:30 IST (inside 21:00–09:05 IST DND window)
        OffsetDateTime nightUtc = OffsetDateTime.of(2026, 11, 25, 17, 0, 0, 0, ZoneOffset.UTC);
        assertThat(CallingDndPolicy.isInDndWindow(nightUtc, 21, 9, 5)).isTrue();

        OffsetDateTime adjusted = CallingDndPolicy.adjustForDnd(nightUtc, 21, 9, 5);
        // Next morning 09:05 IST = 03:35 UTC on 2026-11-26
        assertThat(adjusted.withOffsetSameInstant(ZoneOffset.UTC))
                .isEqualTo(OffsetDateTime.of(2026, 11, 26, 3, 35, 0, 0, ZoneOffset.UTC));

        // 08:30 UTC = 14:00 IST (outside DND window)
        OffsetDateTime afternoonUtc = OffsetDateTime.of(2026, 11, 25, 8, 30, 0, 0, ZoneOffset.UTC);
        assertThat(CallingDndPolicy.isInDndWindow(afternoonUtc, 21, 9, 5)).isFalse();
        assertThat(CallingDndPolicy.adjustForDnd(afternoonUtc, 21, 9, 5)).isEqualTo(afternoonUtc);
    }

    @Test
    void phoneValidationAndMaskingHandleIndianMobileNumbersAccurately() {
        assertThat(CallingDndPolicy.isRoutablePhone("+919876543210")).isTrue();
        assertThat(CallingDndPolicy.isRoutablePhone("+911234567890")).isFalse();
        assertThat(CallingDndPolicy.isRoutablePhone("invalid")).isFalse();
        assertThat(CallingDndPolicy.maskPhone("+919876543210")).isEqualTo("+91 98••••3210");
    }

    @Test
    void webhookSignatureVerifierValidatesHmacAndRejectsTamperingOrReplay() {
        Instant fixedNow = Instant.parse("2026-11-25T10:00:00Z");
        Clock fixedClock = Clock.fixed(fixedNow, ZoneOffset.UTC);
        CallingProperties props = new CallingProperties(
                true, "SANDBOX", "http://127.0.0.1:3104", "unit-test-webhook-secret-key-32bytes!",
                false, 15000L, 10, 5);
        WebhookSignatureVerifier verifier = new WebhookSignatureVerifier(props, fixedClock);

        String body = "{\"eventId\":\"evt-1\",\"outcome\":\"CONFIRMED\"}";
        long ts = fixedNow.getEpochSecond();
        String sig = verifier.computeSignature(ts, body);

        assertThat(verifier.verify(String.valueOf(ts), sig, body)).isTrue();
        assertThat(verifier.verify(String.valueOf(ts), sig, body + " ")).isFalse();
        assertThat(verifier.verify(String.valueOf(ts - 600), sig, body)).isFalse();
    }

    @Test
    void fourPillarRtoScoringDistinguishesConfirmedDeniedAndUnansweredCalls() {
        RtoRiskScoringService service = new RtoRiskScoringService(null, null);
        UUID merchantId = UUID.randomUUID();
        Customer customer = new Customer(
                UUID.randomUUID(), merchantId, "Riya Verma", "+919811223344", "riya@example.in");
        customer.recordNewOrder(new BigDecimal("1800.00"), OffsetDateTime.now(ZoneOffset.UTC));

        Order codOrder = new Order(
                UUID.randomUUID(),
                merchantId,
                "ORD-RTO-1",
                customer,
                OrderSource.MANUAL,
                OrderStatus.CREATED,
                PaymentStatus.PENDING,
                PaymentMethod.COD,
                new BigDecimal("1800.00"),
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                new BigDecimal("1800.00"),
                "INR",
                "Flat 402, Sector 62, Near Metro Station, Noida 201301",
                "Flat 402, Sector 62, Near Metro Station, Noida 201301",
                null);

        RtoRiskAssessmentDto baseline = service.computeAssessment(
                codOrder, customer, List.of(codOrder), null, Collections.emptyList());
        assertThat(baseline.reasonCodes()).contains("NEW_CUSTOMER", "CONFIRMATION_PENDING");

        CallSession confirmedSession = new CallSession(
                UUID.randomUUID(), merchantId, codOrder, customer, "k1", "+919811223344",
                "hi-IN", CallSessionStatus.COMPLETED, 3, baseline.totalRiskScore(), baseline.riskBand(), null);
        confirmedSession.setFinalOutcome(CallOutcome.CONFIRMED);

        RtoRiskAssessmentDto afterConfirm = service.computeAssessment(
                codOrder, customer, List.of(codOrder), confirmedSession, Collections.emptyList());
        assertThat(afterConfirm.totalRiskScore()).isLessThan(baseline.totalRiskScore());
        assertThat(afterConfirm.reasonCodes()).contains("CALL_CONFIRMED_INTENT");
        assertThat(afterConfirm.reasonCodes()).doesNotContain("CONFIRMATION_PENDING");

        CallSession unansweredFirstTry = new CallSession(
                UUID.randomUUID(), merchantId, codOrder, customer, "k2", "+919811223344",
                "hi-IN", CallSessionStatus.RETRY_SCHEDULED, 3, baseline.totalRiskScore(), baseline.riskBand(), null);
        unansweredFirstTry.setAttemptCount(1);
        unansweredFirstTry.setFinalOutcome(CallOutcome.NO_ANSWER);

        RtoRiskAssessmentDto afterNoAnswer = service.computeAssessment(
                codOrder, customer, List.of(codOrder), unansweredFirstTry, Collections.emptyList());
        assertThat(afterNoAnswer.callingOutcomePoints()).isZero();
        assertThat(afterNoAnswer.reasonCodes()).contains("CALL_UNANSWERED_NEUTRAL");

        CallSession rejectedSession = new CallSession(
                UUID.randomUUID(), merchantId, codOrder, customer, "k3", "+919811223344",
                "hi-IN", CallSessionStatus.COMPLETED, 3, baseline.totalRiskScore(), baseline.riskBand(), null);
        rejectedSession.setFinalOutcome(CallOutcome.REJECTED);

        RtoRiskAssessmentDto afterReject = service.computeAssessment(
                codOrder, customer, List.of(codOrder), rejectedSession, Collections.emptyList());
        assertThat(afterReject.riskBand()).isEqualTo("HIGH");
        assertThat(afterReject.reasonCodes()).contains("CALL_DENIED_ORDER");
    }
}
