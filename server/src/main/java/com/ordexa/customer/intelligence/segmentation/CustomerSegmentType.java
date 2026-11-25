package com.ordexa.customer.intelligence.segmentation;

public enum CustomerSegmentType {
    NEW_CUSTOMER(
            "NEW_CUSTOMER",
            "New Customer",
            "Customers with exactly one recorded order in this merchant workspace."),
    REPEAT_CUSTOMER(
            "REPEAT_CUSTOMER",
            "Repeat Customer",
            "Customers who have placed two or more orders in this merchant workspace."),
    HIGH_VALUE_CUSTOMER(
            "HIGH_VALUE_CUSTOMER",
            "High Value Customer",
            "Customers whose qualifying non-cancelled spend places them in the merchant's top spending tier."),
    INACTIVE_CUSTOMER(
            "INACTIVE_CUSTOMER",
            "Inactive Customer",
            "Customers whose last qualifying purchase occurred more than the configured inactivity threshold ago."),
    CANCELLATION_PRONE_CUSTOMER(
            "CANCELLATION_PRONE_CUSTOMER",
            "Cancellation-Prone Customer",
            "Customers with sufficient order sample size whose cancellation rate meets or exceeds the configured threshold."),
    COD_HEAVY_CUSTOMER(
            "COD_HEAVY_CUSTOMER",
            "COD-Heavy Customer",
            "Customers with a high proportion of Cash on Delivery orders (payment preference indicator, not a risk score)."),
    LOYAL_CUSTOMER(
            "LOYAL_CUSTOMER",
            "Loyal Customer",
            "Customers demonstrating sustained repeat-purchase behaviour with delivered orders and low cancellation rates.");

    private final String segmentId;
    private final String displayName;
    private final String description;

    CustomerSegmentType(String segmentId, String displayName, String description) {
        this.segmentId = segmentId;
        this.displayName = displayName;
        this.description = description;
    }

    public String getSegmentId() {
        return segmentId;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getDescription() {
        return description;
    }

    public static CustomerSegmentType fromIdOrThrow(String rawId) {
        if (rawId == null || rawId.isBlank()) {
            throw new IllegalArgumentException("Segment ID must not be empty");
        }
        for (CustomerSegmentType type : values()) {
            if (type.segmentId.equalsIgnoreCase(rawId.trim())) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown customer segment: " + rawId);
    }
}
