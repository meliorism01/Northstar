package com.ordexa.customer.intelligence.config;

import java.math.BigDecimal;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "ordexa.intelligence")
public class CustomerIntelligenceProperties {

    /**
     * Percentile threshold (0-100) for HIGH_VALUE_CUSTOMER relative to the merchant's customers.
     * Default: 75 (top 25% of spending customers within the merchant).
     */
    private int highValuePercentile = 75;

    /**
     * Minimum qualifying spend floor (INR) for HIGH_VALUE_CUSTOMER when the merchant has fewer than 4 customers.
     */
    private BigDecimal highValueMinSpendFallback = new BigDecimal("5000.00");

    /**
     * Number of days since the customer's last qualifying purchase before classifying as INACTIVE_CUSTOMER.
     */
    private long inactiveDaysThreshold = 30L;

    /**
     * Minimum order count required before rate-based segments (CANCELLATION_PRONE_CUSTOMER, COD_HEAVY_CUSTOMER)
     * can be assigned, preventing unstable classifications on a single order.
     */
    private int minOrdersForRateSegments = 2;

    /**
     * Minimum cancellation percentage (0-100) required for CANCELLATION_PRONE_CUSTOMER.
     */
    private BigDecimal cancellationProneThresholdPercent = new BigDecimal("50.00");

    /**
     * Minimum COD percentage (0-100) required for COD_HEAVY_CUSTOMER.
     */
    private BigDecimal codHeavyThresholdPercent = new BigDecimal("70.00");

    /**
     * Minimum non-cancelled orders required for LOYAL_CUSTOMER.
     */
    private int loyalMinNonCancelledOrders = 3;

    /**
     * Maximum cancellation percentage (0-100) allowed for LOYAL_CUSTOMER.
     */
    private BigDecimal loyalMaxCancellationPercent = new BigDecimal("20.00");

    public int getHighValuePercentile() {
        return highValuePercentile;
    }

    public void setHighValuePercentile(int highValuePercentile) {
        this.highValuePercentile = highValuePercentile;
    }

    public BigDecimal getHighValueMinSpendFallback() {
        return highValueMinSpendFallback;
    }

    public void setHighValueMinSpendFallback(BigDecimal highValueMinSpendFallback) {
        this.highValueMinSpendFallback = highValueMinSpendFallback;
    }

    public long getInactiveDaysThreshold() {
        return inactiveDaysThreshold;
    }

    public void setInactiveDaysThreshold(long inactiveDaysThreshold) {
        this.inactiveDaysThreshold = inactiveDaysThreshold;
    }

    public int getMinOrdersForRateSegments() {
        return minOrdersForRateSegments;
    }

    public void setMinOrdersForRateSegments(int minOrdersForRateSegments) {
        this.minOrdersForRateSegments = minOrdersForRateSegments;
    }

    public BigDecimal getCancellationProneThresholdPercent() {
        return cancellationProneThresholdPercent;
    }

    public void setCancellationProneThresholdPercent(BigDecimal cancellationProneThresholdPercent) {
        this.cancellationProneThresholdPercent = cancellationProneThresholdPercent;
    }

    public BigDecimal getCodHeavyThresholdPercent() {
        return codHeavyThresholdPercent;
    }

    public void setCodHeavyThresholdPercent(BigDecimal codHeavyThresholdPercent) {
        this.codHeavyThresholdPercent = codHeavyThresholdPercent;
    }

    public int getLoyalMinNonCancelledOrders() {
        return loyalMinNonCancelledOrders;
    }

    public void setLoyalMinNonCancelledOrders(int loyalMinNonCancelledOrders) {
        this.loyalMinNonCancelledOrders = loyalMinNonCancelledOrders;
    }

    public BigDecimal getLoyalMaxCancellationPercent() {
        return loyalMaxCancellationPercent;
    }

    public void setLoyalMaxCancellationPercent(BigDecimal loyalMaxCancellationPercent) {
        this.loyalMaxCancellationPercent = loyalMaxCancellationPercent;
    }
}
