package com.ordexa.calling.integration;

public interface VoiceCallingProvider {

    String providerCode();

    VoiceDispatchResult initiateCall(VoiceDispatchCommand command);
}
