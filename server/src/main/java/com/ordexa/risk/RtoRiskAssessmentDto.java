package com.ordexa.risk;

import java.util.List;

public record RtoRiskAssessmentDto(
        int totalRiskScore,
        String riskBand,
        int behaviouralRiskPoints,
        int orderRiskPoints,
        int callingOutcomePoints,
        int historicalConfirmationPoints,
        List<String> reasonCodes,
        List<RiskFactorReasonDto> reasons,
        String recommendedAction
) {
    public record RiskFactorReasonDto(
            String code,
            String pillar,
            int scoreDelta,
            String label,
            String explanation
    ) {}
}
