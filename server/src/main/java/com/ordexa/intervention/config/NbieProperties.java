package com.ordexa.intervention.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "northstar.nbie")
public class NbieProperties {

    private boolean enabled = true;
    private String rulesetVersion = "NBIE_RULESET_V1";
    private boolean autoEvaluate = false;
    private int defaultRecommendationTtlHours = 24;
    private int maxRtoAssessmentAgeMinutes = 60;
    private int staleCallSignalHours = 24;
    private boolean sandboxOnly = true;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getRulesetVersion() {
        return rulesetVersion;
    }

    public void setRulesetVersion(String rulesetVersion) {
        this.rulesetVersion = rulesetVersion;
    }

    public boolean isAutoEvaluate() {
        return autoEvaluate;
    }

    public void setAutoEvaluate(boolean autoEvaluate) {
        this.autoEvaluate = autoEvaluate;
    }

    public int getDefaultRecommendationTtlHours() {
        return defaultRecommendationTtlHours;
    }

    public void setDefaultRecommendationTtlHours(int defaultRecommendationTtlHours) {
        this.defaultRecommendationTtlHours = defaultRecommendationTtlHours;
    }

    public int getMaxRtoAssessmentAgeMinutes() {
        return maxRtoAssessmentAgeMinutes;
    }

    public void setMaxRtoAssessmentAgeMinutes(int maxRtoAssessmentAgeMinutes) {
        this.maxRtoAssessmentAgeMinutes = maxRtoAssessmentAgeMinutes;
    }

    public int getStaleCallSignalHours() {
        return staleCallSignalHours;
    }

    public void setStaleCallSignalHours(int staleCallSignalHours) {
        this.staleCallSignalHours = staleCallSignalHours;
    }

    public boolean isSandboxOnly() {
        return sandboxOnly;
    }

    public void setSandboxOnly(boolean sandboxOnly) {
        this.sandboxOnly = sandboxOnly;
    }
}
