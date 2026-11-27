package com.ordexa.intervention.adapter;

import com.ordexa.calling.config.CallingProperties;
import com.ordexa.calling.entity.CallSession;
import com.ordexa.calling.entity.CallingConfiguration;
import com.ordexa.calling.integration.SandboxVoiceCallingProvider;
import com.ordexa.calling.repository.CallingConfigurationRepository;
import com.ordexa.calling.service.CallingWorkflowService;
import com.ordexa.common.exception.ErrorCode;
import com.ordexa.common.exception.OrdexaException;
import com.ordexa.intervention.config.NbieProperties;
import com.ordexa.intervention.entity.InterventionRecommendationItem;
import com.ordexa.intervention.model.InterventionEnums.ExecutionLogStatus;
import com.ordexa.intervention.model.InterventionEnums.ExecutionProviderMode;
import com.ordexa.intervention.model.InterventionEnums.InterventionChannel;
import com.ordexa.intervention.model.InterventionType;
import com.ordexa.order.entity.Order;
import com.ordexa.order.entity.OrderStatus;
import com.ordexa.order.entity.PaymentMethod;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Sandbox-only adapter connecting approved NBIE voice-channel interventions to
 * NORTHSTAR's existing AI Calling Agent in SANDBOX / DRY_RUN mode.
 *
 * Strictly refuses execution if calling provider is not SANDBOX.
 * Never initiates live PSTN calls, SMS, WhatsApp, or payment capture.
 */
@Component
public class SandboxVoiceInterventionAdapter implements InterventionExecutionAdapter {

    public static final String CODE = "SANDBOX_VOICE_CALLING_ADAPTER";

    private final CallingWorkflowService callingWorkflowService;
    private final CallingConfigurationRepository callingConfigRepository;
    private final CallingProperties callingProperties;
    private final NbieProperties nbieProperties;

    public SandboxVoiceInterventionAdapter(
            CallingWorkflowService callingWorkflowService,
            CallingConfigurationRepository callingConfigRepository,
            CallingProperties callingProperties,
            NbieProperties nbieProperties) {
        this.callingWorkflowService = callingWorkflowService;
        this.callingConfigRepository = callingConfigRepository;
        this.callingProperties = callingProperties;
        this.nbieProperties = nbieProperties;
    }

    @Override
    public String adapterCode() {
        return CODE;
    }

    @Override
    public boolean supports(InterventionChannel channel) {
        return channel == InterventionChannel.VOICE_SANDBOX;
    }

    @Override
    public AdapterExecutionResult executeSandbox(
            Order order,
            InterventionRecommendationItem item,
            String idempotencyKey) {

        if (!nbieProperties.isSandboxOnly()) {
            throw new OrdexaException(
                    "NBIE execution requires sandbox-only safety mode",
                    ErrorCode.POLICY_RESTRICTION,
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        String configuredGlobalProvider = callingProperties.provider() != null
                ? callingProperties.provider().trim()
                : SandboxVoiceCallingProvider.CODE;
        String merchantProvider = callingConfigRepository.findByMerchantId(order.getMerchantId())
                .map(CallingConfiguration::getProvider)
                .orElse(configuredGlobalProvider);

        if (!SandboxVoiceCallingProvider.CODE.equalsIgnoreCase(configuredGlobalProvider)
                || !SandboxVoiceCallingProvider.CODE.equalsIgnoreCase(merchantProvider)) {
            throw new OrdexaException(
                    "NBIE execution blocked: calling provider must remain SANDBOX (live dialing is disabled)",
                    ErrorCode.POLICY_RESTRICTION,
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("interventionType", item.getInterventionType().name());
        metadata.put("sandboxOnly", true);
        metadata.put("liveCommunicationTriggered", false);
        metadata.put("paymentCollected", false);
        metadata.put("note", "Sandbox dispatch acknowledgment is NOT proof of customer contact or confirmation.");

        String externalRef = null;
        if (item.getInterventionType() == InterventionType.COD_CONFIRMATION
                && order.getPaymentMethod() == PaymentMethod.COD
                && order.getOrderStatus() == OrderStatus.CREATED) {
            // Queue safely in SANDBOX mode without auto-bypassing DND
            Optional<CallSession> session = callingWorkflowService.enrollCodOrderIfEligible(order, false);
            if (session.isPresent()) {
                externalRef = session.get().getId().toString();
                metadata.put("callSessionId", externalRef);
                metadata.put("callSessionStatus", session.get().getStatus().name());
            }
        } else {
            externalRef = "nbie-sandbox-" + item.getId();
            metadata.put("simulatedPromptScope", item.getRequiredEvidence() != null ? item.getRequiredEvidence() : "targeted_inquiry");
        }

        return new AdapterExecutionResult(
                true,
                ExecutionProviderMode.SANDBOX,
                ExecutionLogStatus.ACCEPTED_SANDBOX,
                externalRef,
                metadata);
    }
}
