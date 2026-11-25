package com.ordexa.customer.intelligence.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class CustomerIntelligenceDtos {

    private CustomerIntelligenceDtos() {
    }

    public record IntelligenceOverviewDto(
            int totalCustomers,
            int newCustomers,
            int repeatCustomers,
            int highValueCustomers,
            int inactiveCustomers,
            int cancellationProneCustomers,
            int codHeavyCustomers,
            int loyalCustomers,
            int totalOrders,
            int deliveredOrders,
            int cancelledOrders,
            int pendingOrders,
            BigDecimal totalQualifyingRevenue,
            BigDecimal averageCustomerLifetimeValue,
            BigDecimal averageOrderValue,
            BigDecimal repeatPurchaseRate,
            BigDecimal customerCancellationRate,
            int distinctProductsPurchased,
            List<SegmentSummaryDto> segmentDistribution,
            OffsetDateTime calculatedAt
    ) {
    }

    public record SegmentAssignmentDto(
            String segmentId,
            String segmentName,
            String description,
            String reason,
            Map<String, Object> evidence,
            String thresholdApplied,
            OffsetDateTime calculatedAt
    ) {
    }

    public record SegmentSummaryDto(
            String segmentId,
            String segmentName,
            String description,
            String thresholdRule,
            int customerCount,
            BigDecimal percentageOfCustomers,
            BigDecimal totalSegmentSpend,
            BigDecimal averageCustomerSpend,
            OffsetDateTime calculatedAt
    ) {
    }

    public record CustomerPurchaseMetricsDto(
            int totalOrders,
            int nonCancelledOrders,
            BigDecimal totalSpend,
            BigDecimal grossOrderValueIncludingCancelled,
            BigDecimal averageOrderValue,
            BigDecimal highestOrderValue,
            BigDecimal lowestOrderValue,
            OffsetDateTime firstOrderAt,
            OffsetDateTime lastOrderAt,
            OffsetDateTime lastQualifyingOrderAt,
            Long daysSinceLastOrder,
            Long daysSinceLastQualifyingOrder,
            BigDecimal averageDaysBetweenOrders,
            BigDecimal purchaseFrequencyPerMonth,
            int repeatPurchaseCount,
            int distinctProductsPurchased,
            int totalUnitsPurchased,
            BigDecimal customerLifetimeValue
    ) {
    }

    public record CustomerPaymentBehaviourDto(
            int codOrders,
            int prepaidOrders,
            BigDecimal codPercentage,
            BigDecimal prepaidPercentage,
            int codCancelledOrders,
            int prepaidCancelledOrders,
            Map<String, Integer> paymentMethodDistribution
    ) {
    }

    public record CustomerOrderOutcomeDto(
            int deliveredOrders,
            int cancelledOrders,
            int pendingOrders,
            BigDecimal cancellationPercentage,
            BigDecimal deliveryCompletionPercentage,
            Map<String, Integer> orderStatusDistribution,
            String dataQualityNote
    ) {
    }

    public record CustomerProductPreferenceDto(
            String sku,
            String productName,
            int ordersCount,
            int totalUnitsPurchased,
            BigDecimal totalSpend,
            BigDecimal shareOfCustomerSpendPercent,
            boolean repeatPurchased,
            OffsetDateTime lastPurchasedAt
    ) {
    }

    public record CustomerTimelineEventDto(
            String eventId,
            String eventType,
            String category,
            UUID orderId,
            String orderNumber,
            String title,
            String description,
            String actor,
            BigDecimal amount,
            String currency,
            OffsetDateTime occurredAt
    ) {
    }

    public record RelatedCustomerSummaryDto(
            UUID customerId,
            String fullName,
            String relationshipType,
            List<String> sharedProductSkus,
            List<String> sharedProductNames,
            int sharedProductCount,
            String explanation
    ) {
    }

    public record CustomerRelationshipSummaryDto(
            int connectedOrdersCount,
            int connectedProductsCount,
            int assignedSegmentsCount,
            int sharedProductCustomersCount,
            List<RelatedCustomerSummaryDto> sharedProductCustomers
    ) {
    }

    public record CustomerIntelligenceProfileDto(
            UUID customerId,
            UUID merchantId,
            String fullName,
            String phoneNumber,
            String email,
            OffsetDateTime registeredAt,
            CustomerPurchaseMetricsDto purchaseMetrics,
            CustomerPaymentBehaviourDto paymentBehaviour,
            CustomerOrderOutcomeDto orderOutcomes,
            List<SegmentAssignmentDto> segments,
            List<String> segmentIds,
            String primarySegment,
            OffsetDateTime calculatedAt
    ) {
    }

    public record Customer360Dto(
            CustomerIntelligenceProfileDto profile,
            List<CustomerProductPreferenceDto> productPreferences,
            List<CustomerTimelineEventDto> timeline,
            CustomerRelationshipSummaryDto relationships,
            GraphResponseDto customerSubgraph
    ) {
    }

    public record ProductCustomerBuyerDto(
            UUID customerId,
            String fullName,
            String phoneNumber,
            int ordersCount,
            int unitsPurchased,
            BigDecimal totalSpentOnProduct,
            boolean repeatBuyer,
            OffsetDateTime lastPurchasedAt
    ) {
    }

    public record ProductIntelligenceDto(
            String sku,
            String productName,
            int ordersCount,
            int nonCancelledOrdersCount,
            int unitsPurchased,
            int cancelledUnits,
            BigDecimal totalRevenue,
            BigDecimal averageUnitPrice,
            int uniqueCustomers,
            int repeatCustomerCount,
            BigDecimal repeatCustomerRatePercent,
            OffsetDateTime firstPurchasedAt,
            OffsetDateTime lastPurchasedAt
    ) {
    }

    public record ProductCoPurchaseDto(
            String skuA,
            String productNameA,
            String skuB,
            String productNameB,
            int coPurchaseOrderCount,
            int sharedCustomerCount,
            BigDecimal orderSupportPercentage,
            BigDecimal customerOverlapPercentage,
            String explanation
    ) {
    }

    public record ProductDetailIntelligenceDto(
            ProductIntelligenceDto product,
            List<ProductCustomerBuyerDto> buyers,
            List<ProductCoPurchaseDto> coPurchasedProducts
    ) {
    }

    public record GraphNodeDto(
            String id,
            String type,
            String label,
            String sublabel,
            Map<String, Object> metrics
    ) {
    }

    public record GraphEdgeDto(
            String id,
            String source,
            String target,
            String type,
            String label,
            Map<String, Object> metadata
    ) {
    }

    public record GraphMetadataDto(
            int totalNodes,
            int totalEdges,
            int customerNodes,
            int orderNodes,
            int productNodes,
            int segmentNodes,
            Map<String, Object> appliedFilters,
            boolean truncatedByLimit,
            int maxNodesLimit,
            OffsetDateTime generatedAt
    ) {
    }

    public record GraphResponseDto(
            List<GraphNodeDto> nodes,
            List<GraphEdgeDto> edges,
            GraphMetadataDto metadata
    ) {
    }
}
