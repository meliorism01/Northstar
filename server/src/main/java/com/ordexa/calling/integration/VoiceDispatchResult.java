package com.ordexa.calling.integration;

public record VoiceDispatchResult(
        boolean accepted,
        boolean ambiguousTimeout,
        String providerCode,
        String providerCallId,
        String roomName,
        String errorMessage
) {
    public static VoiceDispatchResult accepted(String providerCode, String providerCallId, String roomName) {
        return new VoiceDispatchResult(true, false, providerCode, providerCallId, roomName, null);
    }

    public static VoiceDispatchResult rejected(String providerCode, String errorMessage) {
        return new VoiceDispatchResult(false, false, providerCode, null, null, errorMessage);
    }

    public static VoiceDispatchResult ambiguousTimeout(String providerCode, String errorMessage) {
        return new VoiceDispatchResult(false, true, providerCode, null, null, errorMessage);
    }
}
