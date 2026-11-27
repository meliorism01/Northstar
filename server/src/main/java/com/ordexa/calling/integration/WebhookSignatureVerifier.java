package com.ordexa.calling.integration;

import com.ordexa.calling.config.CallingProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

/**
 * Computes and verifies HMAC-SHA256 signatures for bidirectional communication
 * between Spring Boot and the AI Voice Service / telephony webhooks.
 *
 * Signature input format: {@code "<epochSeconds>.<rawBody>"}
 * Header format: {@code X-Northstar-Signature: sha256=<hex>}
 */
@Component
public class WebhookSignatureVerifier {

    private static final String HMAC_ALGO = "HmacSHA256";
    private static final long MAX_SKEW_SECONDS = 300L; // 5 minutes

    private final CallingProperties properties;
    private final Clock clock;

    public WebhookSignatureVerifier(CallingProperties properties, Clock clock) {
        this.properties = properties;
        this.clock = clock;
    }

    public String computeSignature(long timestampEpochSeconds, String rawBody) {
        return computeSignatureWithSecret(properties.webhookSecret(), timestampEpochSeconds, rawBody);
    }

    public static String computeSignatureWithSecret(
            String secret, long timestampEpochSeconds, String rawBody) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGO);
            SecretKeySpec keySpec = new SecretKeySpec(
                    secret.getBytes(StandardCharsets.UTF_8), HMAC_ALGO);
            mac.init(keySpec);
            String payload = timestampEpochSeconds + "." + (rawBody != null ? rawBody : "");
            byte[] digest = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return "sha256=" + HexFormat.of().formatHex(digest);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to compute HMAC-SHA256 signature", ex);
        }
    }

    public boolean verify(String timestampHeader, String signatureHeader, String rawBody) {
        if (timestampHeader == null || timestampHeader.isBlank()
                || signatureHeader == null || signatureHeader.isBlank()) {
            return false;
        }

        long ts;
        try {
            ts = Long.parseLong(timestampHeader.trim());
        } catch (NumberFormatException ex) {
            return false;
        }

        long nowEpoch = Instant.now(clock).getEpochSecond();
        if (Math.abs(nowEpoch - ts) > MAX_SKEW_SECONDS) {
            return false;
        }

        String expected = computeSignature(ts, rawBody);
        byte[] expectedBytes = expected.getBytes(StandardCharsets.UTF_8);
        byte[] providedBytes = signatureHeader.trim().getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(expectedBytes, providedBytes);
    }
}
