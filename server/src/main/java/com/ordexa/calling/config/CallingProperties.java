package com.ordexa.calling.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "ordexa.calling")
public record CallingProperties(
        Boolean enabled,
        String provider,
        String voiceServiceUrl,
        String webhookSecret,
        Boolean schedulerEnabled,
        Long schedulerIntervalMs,
        Integer batchSize,
        Integer httpTimeoutSeconds
) {
    public CallingProperties {
        if (enabled == null) enabled = true;
        if (provider == null || provider.isBlank()) provider = "SANDBOX";
        if (voiceServiceUrl == null || voiceServiceUrl.isBlank()) voiceServiceUrl = "http://127.0.0.1:3104";
        if (webhookSecret == null || webhookSecret.isBlank()) {
            webhookSecret = "northstar-dev-calling-webhook-signing-secret-min-32b";
        }
        if (schedulerEnabled == null) schedulerEnabled = true;
        if (schedulerIntervalMs == null || schedulerIntervalMs < 1000L) schedulerIntervalMs = 15000L;
        if (batchSize == null || batchSize < 1) batchSize = 15;
        if (httpTimeoutSeconds == null || httpTimeoutSeconds < 2) httpTimeoutSeconds = 8;
    }
}
