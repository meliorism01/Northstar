package com.ordexa.calling.integration;

import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Safe Sandbox Voice Provider used during development, automated testing, and
 * staging when real PSTN calls must not be placed. Accepts outbound dispatches
 * deterministically and creates realistic room / call identifiers ready for
 * webhook or operator outcome simulation.
 */
@Component
public class SandboxVoiceCallingProvider implements VoiceCallingProvider {

    public static final String CODE = "SANDBOX";
    private static final Logger log = LoggerFactory.getLogger(SandboxVoiceCallingProvider.class);

    @Override
    public String providerCode() {
        return CODE;
    }

    @Override
    public VoiceDispatchResult initiateCall(VoiceDispatchCommand command) {
        String shortRef = command.orderNumber().replaceAll("[^A-Za-z0-9-]", "");
        String roomName = "northstar-sandbox-" + shortRef + "-att" + command.attemptNumber();
        String providerCallId = "sbx-call-" + UUID.nameUUIDFromBytes(
                command.idempotencyKey().getBytes()).toString().substring(0, 12);

        log.info(
                "[calling-sandbox] Initiated simulated COD verification call order={} attempt={} lang={} room={}",
                command.orderNumber(),
                command.attemptNumber(),
                command.language(),
                roomName);

        return VoiceDispatchResult.accepted(CODE, providerCallId, roomName);
    }
}
