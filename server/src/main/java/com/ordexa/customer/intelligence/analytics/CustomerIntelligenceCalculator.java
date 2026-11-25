package com.ordexa.customer.intelligence.analytics;

import com.ordexa.customer.entity.Customer;
import com.ordexa.customer.intelligence.config.CustomerIntelligenceProperties;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.CustomerIntelligenceProfileDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.CustomerOrderOutcomeDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.CustomerPaymentBehaviourDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.CustomerProductPreferenceDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.CustomerPurchaseMetricsDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.GraphEdgeDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.GraphMetadataDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.GraphNodeDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.GraphResponseDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.ProductCoPurchaseDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.ProductCustomerBuyerDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.ProductIntelligenceDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.RelatedCustomerSummaryDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.SegmentAssignmentDto;
import com.ordexa.customer.intelligence.graph.GraphEdgeType;
import com.ordexa.customer.intelligence.graph.GraphNodeType;
import com.ordexa.customer.intelligence.segmentation.CustomerSegmentType;
import com.ordexa.order.entity.Order;
import com.ordexa.order.entity.OrderItem;
import com.ordexa.order.entity.OrderStatus;
import com.ordexa.order.entity.PaymentMethod;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;

public final class CustomerIntelligenceCalculator {

    public static final String DATA_QUALITY_NOTE =
            "Cancelled orders reflect pre-delivery or operational cancellations. "
            + "Return-to-Origin (RTO) requires verified courier delivery-outcome telemetry and is never inferred from cancellations.";

    private static final BigDecimal HUNDRED = new BigDecimal("100.00");
    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

    private CustomerIntelligenceCalculator() {
    }

    public static String normalizeSku(String rawSku, String fallbackProductName) {
        if (rawSku != null && !rawSku.isBlank()) {
            return rawSku.trim().toUpperCase(Locale.ROOT);
        }
        if (fallbackProductName != null && !fallbackProductName.isBlank()) {
            return "SKU-" + fallbackProductName.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "-");
        }
        return "SKU-UNKNOWN";
    }

    public static BigDecimal computeHighValueThreshold(
            List<BigDecimal> qualifyingSpends,
            CustomerIntelligenceProperties props) {
        List<BigDecimal> positiveSpends = qualifyingSpends.stream()
                .filter(s -> s != null && s.compareTo(BigDecimal.ZERO) > 0)
                .sorted()
                .toList();

        if (positiveSpends.size() < 4) {
            return props.getHighValueMinSpendFallback().setScale(2, RoundingMode.HALF_UP);
        }

        int percentile = Math.max(1, Math.min(99, props.getHighValuePercentile()));
        int index = (int) Math.ceil((percentile / 100.0) * positiveSpends.size()) - 1;
        index = Math.max(0, Math.min(positiveSpends.size() - 1, index));
        BigDecimal percentileValue = positiveSpends.get(index).setScale(2, RoundingMode.HALF_UP);
        return percentileValue.compareTo(BigDecimal.ZERO) > 0
                ? percentileValue
                : props.getHighValueMinSpendFallback().setScale(2, RoundingMode.HALF_UP);
    }

    public static CustomerPurchaseMetricsDto computePurchaseMetrics(
            List<Order> customerOrders,
            List<OrderItem> customerItems,
            OffsetDateTime now) {
        if (customerOrders == null || customerOrders.isEmpty()) {
            return new CustomerPurchaseMetricsDto(
                    0,
                    0,
                    ZERO,
                    ZERO,
                    ZERO,
                    ZERO,
                    ZERO,
                    null,
                    null,
                    null,
                    null,
                    null,
                    ZERO,
                    ZERO,
                    0,
                    0,
                    0,
                    ZERO);
        }

        List<Order> sortedAsc = customerOrders.stream()
                .sorted(Comparator.comparing(Order::getCreatedAt))
                .toList();

        int totalOrders = sortedAsc.size();
        int nonCancelledOrders = 0;
        BigDecimal qualifyingSpend = ZERO;
        BigDecimal grossOrderValue = ZERO;
        BigDecimal highestQualifying = null;
        BigDecimal lowestQualifying = null;
        OffsetDateTime firstOrderAt = sortedAsc.get(0).getCreatedAt();
        OffsetDateTime lastOrderAt = sortedAsc.get(sortedAsc.size() - 1).getCreatedAt();
        OffsetDateTime lastQualifyingOrderAt = null;

        for (Order o : sortedAsc) {
            BigDecimal amt = o.getTotalAmount().setScale(2, RoundingMode.HALF_UP);
            grossOrderValue = grossOrderValue.add(amt);
            if (o.getOrderStatus() != OrderStatus.CANCELLED) {
                nonCancelledOrders++;
                qualifyingSpend = qualifyingSpend.add(amt);
                if (highestQualifying == null || amt.compareTo(highestQualifying) > 0) {
                    highestQualifying = amt;
                }
                if (lowestQualifying == null || amt.compareTo(lowestQualifying) < 0) {
                    lowestQualifying = amt;
                }
                lastQualifyingOrderAt = o.getCreatedAt();
            }
        }

        BigDecimal averageOrderValue = nonCancelledOrders > 0
                ? qualifyingSpend.divide(BigDecimal.valueOf(nonCancelledOrders), 2, RoundingMode.HALF_UP)
                : ZERO;
        BigDecimal highestVal = highestQualifying != null ? highestQualifying : ZERO;
        BigDecimal lowestVal = lowestQualifying != null ? lowestQualifying : ZERO;

        Long daysSinceLastOrder = Math.max(0L, Duration.between(lastOrderAt, now).toDays());
        Long daysSinceLastQualifying = lastQualifyingOrderAt != null
                ? Math.max(0L, Duration.between(lastQualifyingOrderAt, now).toDays())
                : daysSinceLastOrder;

        BigDecimal avgDaysBetweenOrders = ZERO;
        if (totalOrders >= 2) {
            double totalDaysSpan = Math.max(0.0, Duration.between(firstOrderAt, lastOrderAt).toHours() / 24.0);
            avgDaysBetweenOrders = BigDecimal.valueOf(totalDaysSpan)
                    .divide(BigDecimal.valueOf(totalOrders - 1), 2, RoundingMode.HALF_UP);
        }

        long activeDays = Math.max(1L, Duration.between(firstOrderAt, now).toDays());
        double monthsActive = Math.max(1.0, activeDays / 30.0);
        BigDecimal purchaseFrequencyPerMonth = BigDecimal.valueOf(totalOrders / monthsActive)
                .setScale(2, RoundingMode.HALF_UP);

        int repeatPurchaseCount = Math.max(0, totalOrders - 1);

        Set<String> cancelledOrderIds = sortedAsc.stream()
                .filter(o -> o.getOrderStatus() == OrderStatus.CANCELLED)
                .map(o -> o.getId().toString())
                .collect(Collectors.toSet());

        Set<String> distinctSkus = new HashSet<>();
        int totalUnitsPurchased = 0;
        if (customerItems != null) {
            for (OrderItem item : customerItems) {
                String sku = normalizeSku(item.getSku(), item.getProductName());
                distinctSkus.add(sku);
                if (!cancelledOrderIds.contains(item.getOrder().getId().toString())) {
                    totalUnitsPurchased += item.getQuantity();
                }
            }
        }

        return new CustomerPurchaseMetricsDto(
                totalOrders,
                nonCancelledOrders,
                qualifyingSpend,
                grossOrderValue,
                averageOrderValue,
                highestVal,
                lowestVal,
                firstOrderAt,
                lastOrderAt,
                lastQualifyingOrderAt,
                daysSinceLastOrder,
                daysSinceLastQualifying,
                avgDaysBetweenOrders,
                purchaseFrequencyPerMonth,
                repeatPurchaseCount,
                distinctSkus.size(),
                totalUnitsPurchased,
                qualifyingSpend);
    }

    public static CustomerPaymentBehaviourDto computePaymentBehaviour(List<Order> customerOrders) {
        Map<String, Integer> dist = new LinkedHashMap<>();
        for (PaymentMethod pm : PaymentMethod.values()) {
            dist.put(pm.name(), 0);
        }

        if (customerOrders == null || customerOrders.isEmpty()) {
            return new CustomerPaymentBehaviourDto(0, 0, ZERO, ZERO, 0, 0, dist);
        }

        int total = customerOrders.size();
        int codOrders = 0;
        int prepaidOrders = 0;
        int codCancelled = 0;
        int prepaidCancelled = 0;

        for (Order o : customerOrders) {
            PaymentMethod pm = o.getPaymentMethod();
            dist.put(pm.name(), dist.getOrDefault(pm.name(), 0) + 1);
            boolean isCancelled = o.getOrderStatus() == OrderStatus.CANCELLED;
            if (pm == PaymentMethod.COD) {
                codOrders++;
                if (isCancelled) {
                    codCancelled++;
                }
            } else {
                prepaidOrders++;
                if (isCancelled) {
                    prepaidCancelled++;
                }
            }
        }

        BigDecimal codPct = percentage(codOrders, total);
        BigDecimal prepaidPct = percentage(prepaidOrders, total);

        return new CustomerPaymentBehaviourDto(
                codOrders,
                prepaidOrders,
                codPct,
                prepaidPct,
                codCancelled,
                prepaidCancelled,
                dist);
    }

    public static CustomerOrderOutcomeDto computeOrderOutcomes(List<Order> customerOrders) {
        Map<String, Integer> dist = new LinkedHashMap<>();
        for (OrderStatus status : OrderStatus.values()) {
            dist.put(status.name(), 0);
        }

        if (customerOrders == null || customerOrders.isEmpty()) {
            return new CustomerOrderOutcomeDto(0, 0, 0, ZERO, ZERO, dist, DATA_QUALITY_NOTE);
        }

        int total = customerOrders.size();
        int delivered = 0;
        int cancelled = 0;
        int pending = 0;

        for (Order o : customerOrders) {
            OrderStatus st = o.getOrderStatus();
            dist.put(st.name(), dist.getOrDefault(st.name(), 0) + 1);
            if (st == OrderStatus.DELIVERED) {
                delivered++;
            } else if (st == OrderStatus.CANCELLED) {
                cancelled++;
            } else {
                pending++;
            }
        }

        return new CustomerOrderOutcomeDto(
                delivered,
                cancelled,
                pending,
                percentage(cancelled, total),
                percentage(delivered, total),
                dist,
                DATA_QUALITY_NOTE);
    }

    public static List<SegmentAssignmentDto> evaluateSegments(
            CustomerPurchaseMetricsDto purchase,
            CustomerPaymentBehaviourDto payment,
            CustomerOrderOutcomeDto outcomes,
            BigDecimal merchantHighValueThreshold,
            CustomerIntelligenceProperties props,
            OffsetDateTime calculatedAt) {
        List<SegmentAssignmentDto> segments = new ArrayList<>();
        int totalOrders = purchase.totalOrders();

        if (totalOrders == 1) {
            Map<String, Object> evidence = new LinkedHashMap<>();
            evidence.put("totalOrders", totalOrders);
            evidence.put("firstOrderAt", purchase.firstOrderAt());
            segments.add(new SegmentAssignmentDto(
                    CustomerSegmentType.NEW_CUSTOMER.getSegmentId(),
                    CustomerSegmentType.NEW_CUSTOMER.getDisplayName(),
                    CustomerSegmentType.NEW_CUSTOMER.getDescription(),
                    "Customer has placed exactly 1 recorded order.",
                    evidence,
                    "totalOrders == 1",
                    calculatedAt));
        }

        if (totalOrders >= 2) {
            Map<String, Object> evidence = new LinkedHashMap<>();
            evidence.put("totalOrders", totalOrders);
            evidence.put("repeatPurchaseCount", purchase.repeatPurchaseCount());
            evidence.put("averageDaysBetweenOrders", purchase.averageDaysBetweenOrders());
            segments.add(new SegmentAssignmentDto(
                    CustomerSegmentType.REPEAT_CUSTOMER.getSegmentId(),
                    CustomerSegmentType.REPEAT_CUSTOMER.getDisplayName(),
                    CustomerSegmentType.REPEAT_CUSTOMER.getDescription(),
                    "Customer has placed " + totalOrders + " orders (" + purchase.repeatPurchaseCount() + " repeat purchases).",
                    evidence,
                    "totalOrders >= 2",
                    calculatedAt));
        }

        BigDecimal effectiveHighValueThreshold = merchantHighValueThreshold != null
                ? merchantHighValueThreshold.setScale(2, RoundingMode.HALF_UP)
                : props.getHighValueMinSpendFallback().setScale(2, RoundingMode.HALF_UP);

        if (purchase.totalSpend().compareTo(BigDecimal.ZERO) > 0
                && purchase.totalSpend().compareTo(effectiveHighValueThreshold) >= 0) {
            Map<String, Object> evidence = new LinkedHashMap<>();
            evidence.put("totalSpend", purchase.totalSpend());
            evidence.put("merchantHighValueThreshold", effectiveHighValueThreshold);
            evidence.put("averageOrderValue", purchase.averageOrderValue());
            segments.add(new SegmentAssignmentDto(
                    CustomerSegmentType.HIGH_VALUE_CUSTOMER.getSegmentId(),
                    CustomerSegmentType.HIGH_VALUE_CUSTOMER.getDisplayName(),
                    CustomerSegmentType.HIGH_VALUE_CUSTOMER.getDescription(),
                    "Customer qualifying spend of INR " + purchase.totalSpend()
                            + " meets or exceeds the merchant high-value threshold of INR " + effectiveHighValueThreshold + ".",
                    evidence,
                    "totalSpend >= " + effectiveHighValueThreshold + " (P" + props.getHighValuePercentile() + " merchant percentile)",
                    calculatedAt));
        }

        if (totalOrders >= 1
                && purchase.daysSinceLastQualifyingOrder() != null
                && purchase.daysSinceLastQualifyingOrder() > props.getInactiveDaysThreshold()) {
            Map<String, Object> evidence = new LinkedHashMap<>();
            evidence.put("daysSinceLastQualifyingOrder", purchase.daysSinceLastQualifyingOrder());
            evidence.put("lastQualifyingOrderAt", purchase.lastQualifyingOrderAt() != null
                    ? purchase.lastQualifyingOrderAt()
                    : purchase.lastOrderAt());
            evidence.put("inactiveDaysThreshold", props.getInactiveDaysThreshold());
            segments.add(new SegmentAssignmentDto(
                    CustomerSegmentType.INACTIVE_CUSTOMER.getSegmentId(),
                    CustomerSegmentType.INACTIVE_CUSTOMER.getDisplayName(),
                    CustomerSegmentType.INACTIVE_CUSTOMER.getDescription(),
                    "Last qualifying order was " + purchase.daysSinceLastQualifyingOrder()
                            + " days ago, exceeding the " + props.getInactiveDaysThreshold() + "-day inactivity threshold.",
                    evidence,
                    "daysSinceLastQualifyingOrder > " + props.getInactiveDaysThreshold() + " days",
                    calculatedAt));
        }

        int minSample = Math.max(2, props.getMinOrdersForRateSegments());
        BigDecimal cancelThreshold = props.getCancellationProneThresholdPercent().setScale(2, RoundingMode.HALF_UP);
        if (totalOrders >= minSample
                && outcomes.cancelledOrders() >= 1
                && outcomes.cancellationPercentage().compareTo(cancelThreshold) >= 0) {
            Map<String, Object> evidence = new LinkedHashMap<>();
            evidence.put("cancelledOrders", outcomes.cancelledOrders());
            evidence.put("totalOrders", totalOrders);
            evidence.put("cancellationPercentage", outcomes.cancellationPercentage());
            segments.add(new SegmentAssignmentDto(
                    CustomerSegmentType.CANCELLATION_PRONE_CUSTOMER.getSegmentId(),
                    CustomerSegmentType.CANCELLATION_PRONE_CUSTOMER.getDisplayName(),
                    CustomerSegmentType.CANCELLATION_PRONE_CUSTOMER.getDescription(),
                    "Customer cancelled " + outcomes.cancelledOrders() + " of " + totalOrders
                            + " orders (" + outcomes.cancellationPercentage() + "%).",
                    evidence,
                    "totalOrders >= " + minSample + " AND cancellationPercentage >= " + cancelThreshold + "%",
                    calculatedAt));
        }

        BigDecimal codThreshold = props.getCodHeavyThresholdPercent().setScale(2, RoundingMode.HALF_UP);
        if (totalOrders >= minSample
                && payment.codPercentage().compareTo(codThreshold) >= 0) {
            Map<String, Object> evidence = new LinkedHashMap<>();
            evidence.put("codOrders", payment.codOrders());
            evidence.put("totalOrders", totalOrders);
            evidence.put("codPercentage", payment.codPercentage());
            segments.add(new SegmentAssignmentDto(
                    CustomerSegmentType.COD_HEAVY_CUSTOMER.getSegmentId(),
                    CustomerSegmentType.COD_HEAVY_CUSTOMER.getDisplayName(),
                    CustomerSegmentType.COD_HEAVY_CUSTOMER.getDescription(),
                    "Customer placed " + payment.codOrders() + " of " + totalOrders
                            + " orders via Cash on Delivery (" + payment.codPercentage() + "%).",
                    evidence,
                    "totalOrders >= " + minSample + " AND codPercentage >= " + codThreshold + "%",
                    calculatedAt));
        }

        int loyalMinOrders = Math.max(2, props.getLoyalMinNonCancelledOrders());
        BigDecimal loyalMaxCancel = props.getLoyalMaxCancellationPercent().setScale(2, RoundingMode.HALF_UP);
        if (purchase.nonCancelledOrders() >= loyalMinOrders
                && outcomes.deliveredOrders() >= 1
                && outcomes.cancellationPercentage().compareTo(loyalMaxCancel) <= 0) {
            Map<String, Object> evidence = new LinkedHashMap<>();
            evidence.put("nonCancelledOrders", purchase.nonCancelledOrders());
            evidence.put("deliveredOrders", outcomes.deliveredOrders());
            evidence.put("cancellationPercentage", outcomes.cancellationPercentage());
            evidence.put("totalSpend", purchase.totalSpend());
            segments.add(new SegmentAssignmentDto(
                    CustomerSegmentType.LOYAL_CUSTOMER.getSegmentId(),
                    CustomerSegmentType.LOYAL_CUSTOMER.getDisplayName(),
                    CustomerSegmentType.LOYAL_CUSTOMER.getDescription(),
                    "Customer has " + purchase.nonCancelledOrders() + " non-cancelled orders ("
                            + outcomes.deliveredOrders() + " delivered) with a low cancellation rate of "
                            + outcomes.cancellationPercentage() + "%.",
                    evidence,
                    "nonCancelledOrders >= " + loyalMinOrders
                            + " AND deliveredOrders >= 1 AND cancellationPercentage <= " + loyalMaxCancel + "%",
                    calculatedAt));
        }

        return segments;
    }

    public static String selectPrimarySegment(List<SegmentAssignmentDto> segments) {
        if (segments == null || segments.isEmpty()) {
            return "UNCLASSIFIED";
        }
        List<String> priorityOrder = List.of(
                CustomerSegmentType.LOYAL_CUSTOMER.getSegmentId(),
                CustomerSegmentType.HIGH_VALUE_CUSTOMER.getSegmentId(),
                CustomerSegmentType.CANCELLATION_PRONE_CUSTOMER.getSegmentId(),
                CustomerSegmentType.INACTIVE_CUSTOMER.getSegmentId(),
                CustomerSegmentType.REPEAT_CUSTOMER.getSegmentId(),
                CustomerSegmentType.COD_HEAVY_CUSTOMER.getSegmentId(),
                CustomerSegmentType.NEW_CUSTOMER.getSegmentId());
        Set<String> assigned = segments.stream().map(SegmentAssignmentDto::segmentId).collect(Collectors.toSet());
        for (String candidate : priorityOrder) {
            if (assigned.contains(candidate)) {
                return candidate;
            }
        }
        return segments.get(0).segmentId();
    }

    public static List<CustomerProductPreferenceDto> computeCustomerProductPreferences(
            List<Order> customerOrders,
            List<OrderItem> customerItems,
            BigDecimal customerTotalSpend) {
        if (customerItems == null || customerItems.isEmpty()) {
            return Collections.emptyList();
        }

        Map<UUID, Order> orderById = customerOrders.stream()
                .collect(Collectors.toMap(Order::getId, o -> o, (a, b) -> a));

        class SkuAcc {
            String sku;
            String productName;
            Set<UUID> orderIds = new HashSet<>();
            int totalUnits = 0;
            BigDecimal totalSpend = ZERO;
            OffsetDateTime lastPurchasedAt;
        }

        Map<String, SkuAcc> accBySku = new LinkedHashMap<>();
        for (OrderItem item : customerItems) {
            Order order = orderById.get(item.getOrder().getId());
            if (order != null && order.getOrderStatus() == OrderStatus.CANCELLED) {
                continue;
            }
            String sku = normalizeSku(item.getSku(), item.getProductName());
            SkuAcc acc = accBySku.computeIfAbsent(sku, k -> {
                SkuAcc a = new SkuAcc();
                a.sku = k;
                a.productName = item.getProductName();
                return a;
            });
            if (item.getProductName() != null && !item.getProductName().isBlank()) {
                acc.productName = item.getProductName().trim();
            }
            acc.orderIds.add(item.getOrder().getId());
            acc.totalUnits += item.getQuantity();
            acc.totalSpend = acc.totalSpend.add(item.getTotalPrice().setScale(2, RoundingMode.HALF_UP));
            OffsetDateTime orderTime = order != null ? order.getCreatedAt() : item.getOrder().getCreatedAt();
            if (acc.lastPurchasedAt == null || (orderTime != null && orderTime.isAfter(acc.lastPurchasedAt))) {
                acc.lastPurchasedAt = orderTime;
            }
        }

        return accBySku.values().stream()
                .map(acc -> {
                    BigDecimal share = (customerTotalSpend != null && customerTotalSpend.compareTo(BigDecimal.ZERO) > 0)
                            ? acc.totalSpend.multiply(HUNDRED).divide(customerTotalSpend, 2, RoundingMode.HALF_UP)
                            : ZERO;
                    boolean repeat = acc.orderIds.size() >= 2 || acc.totalUnits >= 2;
                    return new CustomerProductPreferenceDto(
                            acc.sku,
                            acc.productName,
                            acc.orderIds.size(),
                            acc.totalUnits,
                            acc.totalSpend,
                            share,
                            repeat,
                            acc.lastPurchasedAt);
                })
                .sorted(Comparator.comparing(CustomerProductPreferenceDto::totalUnitsPurchased).reversed()
                        .thenComparing(CustomerProductPreferenceDto::totalSpend, Comparator.reverseOrder()))
                .toList();
    }

    public static List<ProductIntelligenceDto> computeProductAnalytics(List<OrderItem> allMerchantItems) {
        if (allMerchantItems == null || allMerchantItems.isEmpty()) {
            return Collections.emptyList();
        }

        class ProductAcc {
            String sku;
            String productName;
            Set<UUID> allOrderIds = new HashSet<>();
            Set<UUID> nonCancelledOrderIds = new HashSet<>();
            int unitsPurchased = 0;
            int cancelledUnits = 0;
            BigDecimal totalRevenue = ZERO;
            Map<UUID, Integer> nonCancelledOrdersPerCustomer = new HashMap<>();
            OffsetDateTime firstPurchasedAt;
            OffsetDateTime lastPurchasedAt;
        }

        Map<String, ProductAcc> bySku = new LinkedHashMap<>();
        for (OrderItem item : allMerchantItems) {
            Order order = item.getOrder();
            String sku = normalizeSku(item.getSku(), item.getProductName());
            ProductAcc acc = bySku.computeIfAbsent(sku, k -> {
                ProductAcc p = new ProductAcc();
                p.sku = k;
                p.productName = item.getProductName().trim();
                return p;
            });

            OffsetDateTime createdAt = order.getCreatedAt();
            if (acc.lastPurchasedAt == null || (createdAt != null && createdAt.isAfter(acc.lastPurchasedAt))) {
                acc.lastPurchasedAt = createdAt;
                if (item.getProductName() != null && !item.getProductName().isBlank()) {
                    acc.productName = item.getProductName().trim();
                }
            }
            if (acc.firstPurchasedAt == null || (createdAt != null && createdAt.isBefore(acc.firstPurchasedAt))) {
                acc.firstPurchasedAt = createdAt;
            }

            acc.allOrderIds.add(order.getId());
            if (order.getOrderStatus() == OrderStatus.CANCELLED) {
                acc.cancelledUnits += item.getQuantity();
            } else {
                acc.nonCancelledOrderIds.add(order.getId());
                acc.unitsPurchased += item.getQuantity();
                acc.totalRevenue = acc.totalRevenue.add(item.getTotalPrice().setScale(2, RoundingMode.HALF_UP));
                UUID customerId = order.getCustomer().getId();
                acc.nonCancelledOrdersPerCustomer.merge(customerId, 1, Integer::sum);
            }
        }

        return bySku.values().stream()
                .map(acc -> {
                    int uniqueCustomers = acc.nonCancelledOrdersPerCustomer.size();
                    int repeatCustomers = (int) acc.nonCancelledOrdersPerCustomer.values().stream()
                            .filter(cnt -> cnt >= 2)
                            .count();
                    BigDecimal avgUnitPrice = acc.unitsPurchased > 0
                            ? acc.totalRevenue.divide(BigDecimal.valueOf(acc.unitsPurchased), 2, RoundingMode.HALF_UP)
                            : ZERO;
                    BigDecimal repeatRate = percentage(repeatCustomers, uniqueCustomers);
                    return new ProductIntelligenceDto(
                            acc.sku,
                            acc.productName,
                            acc.allOrderIds.size(),
                            acc.nonCancelledOrderIds.size(),
                            acc.unitsPurchased,
                            acc.cancelledUnits,
                            acc.totalRevenue,
                            avgUnitPrice,
                            uniqueCustomers,
                            repeatCustomers,
                            repeatRate,
                            acc.firstPurchasedAt,
                            acc.lastPurchasedAt);
                })
                .sorted(Comparator.comparing(ProductIntelligenceDto::totalRevenue).reversed()
                        .thenComparing(ProductIntelligenceDto::unitsPurchased, Comparator.reverseOrder()))
                .toList();
    }

    public static List<ProductCustomerBuyerDto> computeProductBuyers(
            String targetSku,
            List<OrderItem> allMerchantItems) {
        String normalizedTarget = normalizeSku(targetSku, null);
        class BuyerAcc {
            UUID customerId;
            String fullName;
            String phoneNumber;
            Set<UUID> orderIds = new HashSet<>();
            int units = 0;
            BigDecimal spend = ZERO;
            OffsetDateTime lastPurchasedAt;
        }

        Map<UUID, BuyerAcc> buyers = new LinkedHashMap<>();
        for (OrderItem item : allMerchantItems) {
            Order order = item.getOrder();
            if (order.getOrderStatus() == OrderStatus.CANCELLED) {
                continue;
            }
            String sku = normalizeSku(item.getSku(), item.getProductName());
            if (!sku.equalsIgnoreCase(normalizedTarget)) {
                continue;
            }
            Customer c = order.getCustomer();
            BuyerAcc acc = buyers.computeIfAbsent(c.getId(), id -> {
                BuyerAcc b = new BuyerAcc();
                b.customerId = id;
                b.fullName = c.getFullName();
                b.phoneNumber = c.getPhoneNumber();
                return b;
            });
            acc.orderIds.add(order.getId());
            acc.units += item.getQuantity();
            acc.spend = acc.spend.add(item.getTotalPrice().setScale(2, RoundingMode.HALF_UP));
            if (acc.lastPurchasedAt == null || order.getCreatedAt().isAfter(acc.lastPurchasedAt)) {
                acc.lastPurchasedAt = order.getCreatedAt();
            }
        }

        return buyers.values().stream()
                .map(b -> new ProductCustomerBuyerDto(
                        b.customerId,
                        b.fullName,
                        b.phoneNumber,
                        b.orderIds.size(),
                        b.units,
                        b.spend,
                        b.orderIds.size() >= 2 || b.units >= 2,
                        b.lastPurchasedAt))
                .sorted(Comparator.comparing(ProductCustomerBuyerDto::totalSpentOnProduct).reversed())
                .toList();
    }

    public static List<ProductCoPurchaseDto> computeCoPurchases(
            List<OrderItem> allMerchantItems,
            int minCoPurchaseCount,
            int limit) {
        if (allMerchantItems == null || allMerchantItems.isEmpty()) {
            return Collections.emptyList();
        }

        Map<String, String> nameBySku = new HashMap<>();
        Map<UUID, Set<String>> skusByOrder = new HashMap<>();
        Map<UUID, Set<String>> skusByCustomer = new HashMap<>();
        Map<String, Set<UUID>> customersBySku = new HashMap<>();

        for (OrderItem item : allMerchantItems) {
            Order order = item.getOrder();
            if (order.getOrderStatus() == OrderStatus.CANCELLED) {
                continue;
            }
            String sku = normalizeSku(item.getSku(), item.getProductName());
            nameBySku.putIfAbsent(sku, item.getProductName().trim());
            skusByOrder.computeIfAbsent(order.getId(), k -> new TreeSet<>()).add(sku);
            UUID customerId = order.getCustomer().getId();
            skusByCustomer.computeIfAbsent(customerId, k -> new TreeSet<>()).add(sku);
            customersBySku.computeIfAbsent(sku, k -> new HashSet<>()).add(customerId);
        }

        int totalQualifyingOrders = Math.max(1, skusByOrder.size());
        Map<String, Integer> sameOrderPairCounts = new HashMap<>();
        Map<String, Set<UUID>> sharedCustomersByPair = new HashMap<>();

        for (Set<String> orderSkus : skusByOrder.values()) {
            List<String> list = new ArrayList<>(orderSkus);
            for (int i = 0; i < list.size(); i++) {
                for (int j = i + 1; j < list.size(); j++) {
                    String key = list.get(i) + "||" + list.get(j);
                    sameOrderPairCounts.merge(key, 1, Integer::sum);
                }
            }
        }

        for (Map.Entry<UUID, Set<String>> entry : skusByCustomer.entrySet()) {
            UUID customerId = entry.getKey();
            List<String> list = new ArrayList<>(entry.getValue());
            for (int i = 0; i < list.size(); i++) {
                for (int j = i + 1; j < list.size(); j++) {
                    String key = list.get(i) + "||" + list.get(j);
                    sharedCustomersByPair.computeIfAbsent(key, k -> new HashSet<>()).add(customerId);
                }
            }
        }

        Set<String> allPairKeys = new HashSet<>();
        allPairKeys.addAll(sameOrderPairCounts.keySet());
        allPairKeys.addAll(sharedCustomersByPair.keySet());

        int effectiveMin = Math.max(1, minCoPurchaseCount);
        List<ProductCoPurchaseDto> results = new ArrayList<>();

        for (String pairKey : allPairKeys) {
            String[] parts = pairKey.split("\\|\\|");
            String skuA = parts[0];
            String skuB = parts[1];
            int orderCount = sameOrderPairCounts.getOrDefault(pairKey, 0);
            int sharedCustCount = sharedCustomersByPair.getOrDefault(pairKey, Collections.emptySet()).size();

            if (orderCount < effectiveMin && sharedCustCount < effectiveMin) {
                continue;
            }

            BigDecimal orderSupportPct = percentage(orderCount, totalQualifyingOrders);
            int unionCustomers = customersBySku.getOrDefault(skuA, Collections.emptySet()).size()
                    + customersBySku.getOrDefault(skuB, Collections.emptySet()).size()
                    - sharedCustCount;
            BigDecimal customerOverlapPct = percentage(sharedCustCount, Math.max(1, unionCustomers));

            String nameA = nameBySku.getOrDefault(skuA, skuA);
            String nameB = nameBySku.getOrDefault(skuB, skuB);
            String explanation = String.format(
                    "%s (%s) and %s (%s) were purchased together in %d order(s) and bought by %d shared customer(s).",
                    nameA, skuA, nameB, skuB, orderCount, sharedCustCount);

            results.add(new ProductCoPurchaseDto(
                    skuA,
                    nameA,
                    skuB,
                    nameB,
                    orderCount,
                    sharedCustCount,
                    orderSupportPct,
                    customerOverlapPct,
                    explanation));
        }

        return results.stream()
                .sorted(Comparator.comparing(ProductCoPurchaseDto::coPurchaseOrderCount).reversed()
                        .thenComparing(ProductCoPurchaseDto::sharedCustomerCount, Comparator.reverseOrder())
                        .thenComparing(ProductCoPurchaseDto::skuA))
                .limit(Math.max(1, limit))
                .toList();
    }

    public static List<RelatedCustomerSummaryDto> computeSharedProductCustomers(
            UUID targetCustomerId,
            List<OrderItem> allMerchantItems) {
        if (allMerchantItems == null || allMerchantItems.isEmpty()) {
            return Collections.emptyList();
        }

        Map<String, String> productNameBySku = new HashMap<>();
        Map<UUID, Set<String>> skusByCustomer = new HashMap<>();
        Map<UUID, Customer> customerById = new HashMap<>();

        for (OrderItem item : allMerchantItems) {
            Order order = item.getOrder();
            if (order.getOrderStatus() == OrderStatus.CANCELLED) {
                continue;
            }
            Customer c = order.getCustomer();
            String sku = normalizeSku(item.getSku(), item.getProductName());
            productNameBySku.putIfAbsent(sku, item.getProductName().trim());
            customerById.putIfAbsent(c.getId(), c);
            skusByCustomer.computeIfAbsent(c.getId(), k -> new LinkedHashSet<>()).add(sku);
        }

        Set<String> targetSkus = skusByCustomer.getOrDefault(targetCustomerId, Collections.emptySet());
        if (targetSkus.isEmpty()) {
            return Collections.emptyList();
        }

        List<RelatedCustomerSummaryDto> related = new ArrayList<>();
        for (Map.Entry<UUID, Set<String>> entry : skusByCustomer.entrySet()) {
            UUID otherId = entry.getKey();
            if (otherId.equals(targetCustomerId)) {
                continue;
            }
            List<String> sharedSkus = entry.getValue().stream()
                    .filter(targetSkus::contains)
                    .sorted()
                    .toList();
            if (sharedSkus.isEmpty()) {
                continue;
            }
            List<String> sharedNames = sharedSkus.stream()
                    .map(sku -> productNameBySku.getOrDefault(sku, sku))
                    .toList();
            Customer other = customerById.get(otherId);
            related.add(new RelatedCustomerSummaryDto(
                    otherId,
                    other.getFullName(),
                    "SHARED_PRODUCT_PURCHASE",
                    sharedSkus,
                    sharedNames,
                    sharedSkus.size(),
                    "Both customers independently purchased " + String.join(", ", sharedNames)
                            + " within this merchant workspace."));
        }

        return related.stream()
                .sorted(Comparator.comparing(RelatedCustomerSummaryDto::sharedProductCount).reversed()
                        .thenComparing(RelatedCustomerSummaryDto::fullName))
                .limit(15)
                .toList();
    }

    public static GraphResponseDto buildGraph(
            List<CustomerIntelligenceProfileDto> customerProfiles,
            List<Order> orders,
            List<OrderItem> orderItems,
            List<ProductIntelligenceDto> productIntelligence,
            GraphNodeType nodeTypeFilter,
            UUID customerIdFilter,
            String productSkuFilter,
            String segmentFilter,
            int maxNodesLimit,
            OffsetDateTime generatedAt) {

        int safeLimit = Math.max(10, Math.min(500, maxNodesLimit));
        String normalizedSkuFilter = (productSkuFilter != null && !productSkuFilter.isBlank())
                ? productSkuFilter.trim().toUpperCase(Locale.ROOT)
                : null;
        String normalizedSegmentFilter = (segmentFilter != null && !segmentFilter.isBlank())
                ? segmentFilter.trim().toUpperCase(Locale.ROOT)
                : null;

        Map<UUID, List<OrderItem>> itemsByOrderId = orderItems.stream()
                .collect(Collectors.groupingBy(i -> i.getOrder().getId()));

        Set<UUID> allowedCustomerIds = new LinkedHashSet<>();
        for (CustomerIntelligenceProfileDto profile : customerProfiles) {
            if (customerIdFilter != null && !profile.customerId().equals(customerIdFilter)) {
                continue;
            }
            if (normalizedSegmentFilter != null && !profile.segmentIds().contains(normalizedSegmentFilter)) {
                continue;
            }
            allowedCustomerIds.add(profile.customerId());
        }

        if (normalizedSkuFilter != null) {
            Set<UUID> buyersOfSku = orderItems.stream()
                    .filter(i -> normalizeSku(i.getSku(), i.getProductName()).equalsIgnoreCase(normalizedSkuFilter))
                    .map(i -> i.getOrder().getCustomer().getId())
                    .collect(Collectors.toSet());
            allowedCustomerIds.retainAll(buyersOfSku);
        }

        Map<String, GraphNodeDto> nodesById = new LinkedHashMap<>();
        List<GraphEdgeDto> allEdges = new ArrayList<>();
        boolean truncated = false;

        Map<String, ProductIntelligenceDto> productBySku = productIntelligence.stream()
                .collect(Collectors.toMap(ProductIntelligenceDto::sku, p -> p, (a, b) -> a));

        Map<String, Integer> segmentCounts = new LinkedHashMap<>();
        for (CustomerIntelligenceProfileDto p : customerProfiles) {
            for (String segId : p.segmentIds()) {
                segmentCounts.merge(segId, 1, Integer::sum);
            }
        }

        // 1. Add CUSTOMER and SEGMENT nodes & BELONGS_TO edges
        for (CustomerIntelligenceProfileDto profile : customerProfiles) {
            if (!allowedCustomerIds.contains(profile.customerId())) {
                continue;
            }
            String custNodeId = "customer:" + profile.customerId();
            if (shouldIncludeNodeType(nodeTypeFilter, GraphNodeType.CUSTOMER)) {
                if (nodesById.size() < safeLimit) {
                    Map<String, Object> metrics = new LinkedHashMap<>();
                    metrics.put("customerId", profile.customerId());
                    metrics.put("name", profile.fullName());
                    metrics.put("phoneNumber", profile.phoneNumber());
                    metrics.put("totalOrders", profile.purchaseMetrics().totalOrders());
                    metrics.put("totalSpend", profile.purchaseMetrics().totalSpend());
                    metrics.put("averageOrderValue", profile.purchaseMetrics().averageOrderValue());
                    metrics.put("customerSegment", profile.primarySegment());
                    metrics.put("segments", profile.segmentIds());
                    metrics.put("lastOrderAt", profile.purchaseMetrics().lastOrderAt());
                    nodesById.put(custNodeId, new GraphNodeDto(
                            custNodeId,
                            GraphNodeType.CUSTOMER.name(),
                            profile.fullName(),
                            profile.primarySegment().replace('_', ' '),
                            metrics));
                } else {
                    truncated = true;
                }
            }

            for (SegmentAssignmentDto seg : profile.segments()) {
                if (normalizedSegmentFilter != null && !seg.segmentId().equalsIgnoreCase(normalizedSegmentFilter)) {
                    continue;
                }
                String segNodeId = "segment:" + seg.segmentId();
                if (shouldIncludeNodeType(nodeTypeFilter, GraphNodeType.SEGMENT)) {
                    if (!nodesById.containsKey(segNodeId)) {
                        if (nodesById.size() < safeLimit) {
                            Map<String, Object> segMetrics = new LinkedHashMap<>();
                            segMetrics.put("segmentId", seg.segmentId());
                            segMetrics.put("segmentName", seg.segmentName());
                            segMetrics.put("description", seg.description());
                            segMetrics.put("customerCount", segmentCounts.getOrDefault(seg.segmentId(), 1));
                            nodesById.put(segNodeId, new GraphNodeDto(
                                    segNodeId,
                                    GraphNodeType.SEGMENT.name(),
                                    seg.segmentName(),
                                    segmentCounts.getOrDefault(seg.segmentId(), 1) + " customer(s)",
                                    segMetrics));
                        } else {
                            truncated = true;
                        }
                    }
                }
                allEdges.add(new GraphEdgeDto(
                        "edge:belongs:" + profile.customerId() + ":" + seg.segmentId(),
                        custNodeId,
                        segNodeId,
                        GraphEdgeType.BELONGS_TO.name(),
                        "BELONGS_TO",
                        Map.of("reason", seg.reason(), "threshold", seg.thresholdApplied())));
            }
        }

        // 2. Add ORDER and PRODUCT nodes, PLACED, CONTAINS, and REPEATEDLY_PURCHASED edges
        Map<String, Map<String, Integer>> customerSkuOrderCounts = new HashMap<>();
        Map<String, Map<String, Integer>> customerSkuUnitCounts = new HashMap<>();
        Map<String, Set<UUID>> customersPerSku = new HashMap<>();
        Map<UUID, CustomerIntelligenceProfileDto> profileById = customerProfiles.stream()
                .collect(Collectors.toMap(CustomerIntelligenceProfileDto::customerId, p -> p));

        for (Order order : orders) {
            UUID custId = order.getCustomer().getId();
            if (!allowedCustomerIds.contains(custId)) {
                continue;
            }
            List<OrderItem> oItems = itemsByOrderId.getOrDefault(order.getId(), Collections.emptyList());
            if (normalizedSkuFilter != null) {
                boolean hasSku = oItems.stream()
                        .anyMatch(i -> normalizeSku(i.getSku(), i.getProductName()).equalsIgnoreCase(normalizedSkuFilter));
                if (!hasSku) {
                    continue;
                }
            }

            String custNodeId = "customer:" + custId;
            String orderNodeId = "order:" + order.getId();

            if (shouldIncludeNodeType(nodeTypeFilter, GraphNodeType.ORDER)) {
                if (nodesById.size() < safeLimit) {
                    Map<String, Object> orderMetrics = new LinkedHashMap<>();
                    orderMetrics.put("orderId", order.getId());
                    orderMetrics.put("orderNumber", order.getOrderNumber());
                    orderMetrics.put("totalAmount", order.getTotalAmount());
                    orderMetrics.put("orderStatus", order.getOrderStatus().name());
                    orderMetrics.put("paymentMethod", order.getPaymentMethod().name());
                    orderMetrics.put("createdAt", order.getCreatedAt());
                    nodesById.put(orderNodeId, new GraphNodeDto(
                            orderNodeId,
                            GraphNodeType.ORDER.name(),
                            order.getOrderNumber(),
                            order.getOrderStatus().name() + " · " + order.getPaymentMethod().name(),
                            orderMetrics));
                } else {
                    truncated = true;
                }
            }

            allEdges.add(new GraphEdgeDto(
                    "edge:placed:" + custId + ":" + order.getId(),
                    custNodeId,
                    orderNodeId,
                    GraphEdgeType.PLACED.name(),
                    "PLACED",
                    Map.of("orderStatus", order.getOrderStatus().name(), "totalAmount", order.getTotalAmount())));

            Set<String> skusInThisOrder = new HashSet<>();
            for (OrderItem item : oItems) {
                String sku = normalizeSku(item.getSku(), item.getProductName());
                if (normalizedSkuFilter != null && !sku.equalsIgnoreCase(normalizedSkuFilter)) {
                    continue;
                }
                String prodNodeId = "product:" + sku;
                ProductIntelligenceDto prodStats = productBySku.get(sku);

                if (shouldIncludeNodeType(nodeTypeFilter, GraphNodeType.PRODUCT)) {
                    if (!nodesById.containsKey(prodNodeId)) {
                        if (nodesById.size() < safeLimit) {
                            Map<String, Object> prodMetrics = new LinkedHashMap<>();
                            prodMetrics.put("productName", prodStats != null ? prodStats.productName() : item.getProductName());
                            prodMetrics.put("sku", sku);
                            prodMetrics.put("unitsPurchased", prodStats != null ? prodStats.unitsPurchased() : item.getQuantity());
                            prodMetrics.put("totalRevenue", prodStats != null ? prodStats.totalRevenue() : item.getTotalPrice());
                            prodMetrics.put("uniqueCustomers", prodStats != null ? prodStats.uniqueCustomers() : 1);
                            nodesById.put(prodNodeId, new GraphNodeDto(
                                    prodNodeId,
                                    GraphNodeType.PRODUCT.name(),
                                    prodStats != null ? prodStats.productName() : item.getProductName(),
                                    sku,
                                    prodMetrics));
                        } else {
                            truncated = true;
                        }
                    }
                }

                allEdges.add(new GraphEdgeDto(
                        "edge:contains:" + order.getId() + ":" + sku,
                        orderNodeId,
                        prodNodeId,
                        GraphEdgeType.CONTAINS.name(),
                        "CONTAINS",
                        Map.of("quantity", item.getQuantity(), "totalPrice", item.getTotalPrice())));

                if (order.getOrderStatus() != OrderStatus.CANCELLED) {
                    skusInThisOrder.add(sku);
                    customerSkuUnitCounts
                            .computeIfAbsent(custId.toString(), k -> new HashMap<>())
                            .merge(sku, item.getQuantity(), Integer::sum);
                    customersPerSku.computeIfAbsent(sku, k -> new LinkedHashSet<>()).add(custId);
                }
            }

            for (String sku : skusInThisOrder) {
                customerSkuOrderCounts
                        .computeIfAbsent(custId.toString(), k -> new HashMap<>())
                        .merge(sku, 1, Integer::sum);
            }
        }

        // 3. Add REPEATEDLY_PURCHASED edges (CUSTOMER -> PRODUCT)
        for (Map.Entry<String, Map<String, Integer>> entry : customerSkuOrderCounts.entrySet()) {
            String custIdStr = entry.getKey();
            String custNodeId = "customer:" + custIdStr;
            for (Map.Entry<String, Integer> skuEntry : entry.getValue().entrySet()) {
                String sku = skuEntry.getKey();
                int orderCnt = skuEntry.getValue();
                int unitCnt = customerSkuUnitCounts
                        .getOrDefault(custIdStr, Collections.emptyMap())
                        .getOrDefault(sku, 0);
                if (orderCnt >= 2 || unitCnt >= 2) {
                    String prodNodeId = "product:" + sku;
                    allEdges.add(new GraphEdgeDto(
                            "edge:repeat:" + custIdStr + ":" + sku,
                            custNodeId,
                            prodNodeId,
                            GraphEdgeType.REPEATEDLY_PURCHASED.name(),
                            "REPEATEDLY_PURCHASED",
                            Map.of("ordersCount", orderCnt, "unitsPurchased", unitCnt)));
                }
            }
        }

        // 4. Add RELATED_TO edges (CUSTOMER -> CUSTOMER via shared product purchases)
        Map<String, Set<String>> sharedSkusByCustomerPair = new TreeMap<>();
        for (Map.Entry<String, Set<UUID>> entry : customersPerSku.entrySet()) {
            String sku = entry.getKey();
            List<UUID> buyers = new ArrayList<>(entry.getValue());
            for (int i = 0; i < buyers.size(); i++) {
                for (int j = i + 1; j < buyers.size(); j++) {
                    UUID c1 = buyers.get(i);
                    UUID c2 = buyers.get(j);
                    String pairKey = c1.toString().compareTo(c2.toString()) < 0
                            ? c1 + "||" + c2
                            : c2 + "||" + c1;
                    sharedSkusByCustomerPair.computeIfAbsent(pairKey, k -> new TreeSet<>()).add(sku);
                }
            }
        }

        for (Map.Entry<String, Set<String>> entry : sharedSkusByCustomerPair.entrySet()) {
            String[] pair = entry.getKey().split("\\|\\|");
            UUID c1 = UUID.fromString(pair[0]);
            UUID c2 = UUID.fromString(pair[1]);
            String n1 = "customer:" + c1;
            String n2 = "customer:" + c2;
            List<String> sharedSkus = new ArrayList<>(entry.getValue());
            CustomerIntelligenceProfileDto p1 = profileById.get(c1);
            CustomerIntelligenceProfileDto p2 = profileById.get(c2);
            String label1 = p1 != null ? p1.fullName() : c1.toString();
            String label2 = p2 != null ? p2.fullName() : c2.toString();

            Map<String, Object> relMeta = new LinkedHashMap<>();
            relMeta.put("relationshipBasis", "SHARED_PRODUCT_PURCHASE");
            relMeta.put("sharedSkus", sharedSkus);
            relMeta.put("sharedProductCount", sharedSkus.size());
            relMeta.put("explanation", label1 + " and " + label2 + " both purchased SKU(s): " + String.join(", ", sharedSkus));

            allEdges.add(new GraphEdgeDto(
                    "edge:related:" + c1 + ":" + c2,
                    n1,
                    n2,
                    GraphEdgeType.RELATED_TO.name(),
                    "SHARED_PRODUCT",
                    relMeta));
        }

        // Keep only edges whose source AND target exist in nodesById
        List<GraphEdgeDto> validEdges = allEdges.stream()
                .filter(e -> nodesById.containsKey(e.source()) && nodesById.containsKey(e.target()))
                .toList();

        List<GraphNodeDto> finalNodes = new ArrayList<>(nodesById.values());
        int custCount = (int) finalNodes.stream().filter(n -> GraphNodeType.CUSTOMER.name().equals(n.type())).count();
        int ordCount = (int) finalNodes.stream().filter(n -> GraphNodeType.ORDER.name().equals(n.type())).count();
        int prodCount = (int) finalNodes.stream().filter(n -> GraphNodeType.PRODUCT.name().equals(n.type())).count();
        int segCount = (int) finalNodes.stream().filter(n -> GraphNodeType.SEGMENT.name().equals(n.type())).count();

        Map<String, Object> appliedFilters = new LinkedHashMap<>();
        appliedFilters.put("nodeType", nodeTypeFilter != null ? nodeTypeFilter.name() : "ALL");
        appliedFilters.put("customerId", customerIdFilter != null ? customerIdFilter.toString() : null);
        appliedFilters.put("productSku", normalizedSkuFilter);
        appliedFilters.put("segment", normalizedSegmentFilter);
        appliedFilters.put("limit", safeLimit);

        GraphMetadataDto metadata = new GraphMetadataDto(
                finalNodes.size(),
                validEdges.size(),
                custCount,
                ordCount,
                prodCount,
                segCount,
                appliedFilters,
                truncated,
                safeLimit,
                generatedAt);

        return new GraphResponseDto(finalNodes, validEdges, metadata);
    }

    /**
     * Builds a clean, single-customer relationship graph containing ONLY:
     * - 1 central CUSTOMER node (the selected customer)
     * - Connected ORDER nodes belonging to that customer
     * - Consolidated PRODUCT nodes purchased in those orders (with customer-specific unitsPurchased)
     * - Connected SEGMENT nodes assigned to that customer
     * - Valid PLACED, CONTAINS, and BELONGS_TO edges between them.
     */
    public static GraphResponseDto buildIndividualCustomerGraph(
            CustomerIntelligenceProfileDto profile,
            List<Order> customerOrders,
            List<OrderItem> customerItems,
            OffsetDateTime generatedAt) {

        Map<String, GraphNodeDto> nodesById = new LinkedHashMap<>();
        List<GraphEdgeDto> edges = new ArrayList<>();

        String custNodeId = "customer:" + profile.customerId();
        Map<String, Object> custMetrics = new LinkedHashMap<>();
        custMetrics.put("customerId", profile.customerId());
        custMetrics.put("name", profile.fullName());
        custMetrics.put("phoneNumber", profile.phoneNumber());
        custMetrics.put("email", profile.email());
        custMetrics.put("totalOrders", profile.purchaseMetrics().totalOrders());
        custMetrics.put("totalSpend", profile.purchaseMetrics().totalSpend());
        custMetrics.put("averageOrderValue", profile.purchaseMetrics().averageOrderValue());
        custMetrics.put("customerSegment", profile.primarySegment());
        custMetrics.put("segments", profile.segmentIds());
        custMetrics.put("lastOrderAt", profile.purchaseMetrics().lastOrderAt());

        nodesById.put(custNodeId, new GraphNodeDto(
                custNodeId,
                GraphNodeType.CUSTOMER.name(),
                profile.fullName(),
                "+91 " + profile.phoneNumber(),
                custMetrics));

        // 1. Assigned SEGMENT nodes & CUSTOMER -> BELONGS_TO -> SEGMENT edges
        for (SegmentAssignmentDto seg : profile.segments()) {
            String segNodeId = "segment:" + seg.segmentId();
            Map<String, Object> segMetrics = new LinkedHashMap<>();
            segMetrics.put("segmentId", seg.segmentId());
            segMetrics.put("segmentName", seg.segmentName());
            segMetrics.put("description", seg.description());
            segMetrics.put("reason", seg.reason());
            segMetrics.put("thresholdApplied", seg.thresholdApplied());

            nodesById.put(segNodeId, new GraphNodeDto(
                    segNodeId,
                    GraphNodeType.SEGMENT.name(),
                    seg.segmentName(),
                    seg.thresholdApplied(),
                    segMetrics));

            edges.add(new GraphEdgeDto(
                    "edge:belongs:" + profile.customerId() + ":" + seg.segmentId(),
                    custNodeId,
                    segNodeId,
                    GraphEdgeType.BELONGS_TO.name(),
                    "BELONGS_TO",
                    Map.of("reason", seg.reason(), "threshold", seg.thresholdApplied())));
        }

        // Pre-aggregate customer-specific units & spend per SKU across their orders so each consolidated
        // PRODUCT node shows the exact units purchased by THIS customer.
        class CustomerProductAgg {
            String sku;
            String productName;
            int unitsPurchased = 0;
            BigDecimal totalSpend = ZERO;
            Set<UUID> orderIds = new LinkedHashSet<>();
        }

        Map<String, CustomerProductAgg> productAggBySku = new LinkedHashMap<>();
        Map<UUID, List<OrderItem>> itemsByOrderId = new LinkedHashMap<>();

        if (customerItems != null) {
            for (OrderItem item : customerItems) {
                UUID ordId = item.getOrder().getId();
                itemsByOrderId.computeIfAbsent(ordId, k -> new ArrayList<>()).add(item);

                String sku = normalizeSku(item.getSku(), item.getProductName());
                CustomerProductAgg agg = productAggBySku.computeIfAbsent(sku, k -> {
                    CustomerProductAgg a = new CustomerProductAgg();
                    a.sku = k;
                    a.productName = item.getProductName().trim();
                    return a;
                });
                if (item.getProductName() != null && !item.getProductName().isBlank()) {
                    agg.productName = item.getProductName().trim();
                }
                agg.unitsPurchased += item.getQuantity();
                agg.totalSpend = agg.totalSpend.add(item.getTotalPrice().setScale(2, RoundingMode.HALF_UP));
                agg.orderIds.add(ordId);
            }
        }

        // 2. Customer's ORDER nodes & CUSTOMER -> PLACED -> ORDER edges
        List<Order> sortedOrders = customerOrders != null
                ? customerOrders.stream().sorted(Comparator.comparing(Order::getCreatedAt).reversed()).toList()
                : Collections.emptyList();

        Set<String> addedOrderProductEdgeKeys = new HashSet<>();

        for (Order order : sortedOrders) {
            if (!order.getCustomer().getId().equals(profile.customerId())) {
                continue;
            }
            String orderNodeId = "order:" + order.getId();
            Map<String, Object> orderMetrics = new LinkedHashMap<>();
            orderMetrics.put("orderId", order.getId());
            orderMetrics.put("orderNumber", order.getOrderNumber());
            orderMetrics.put("totalAmount", order.getTotalAmount());
            orderMetrics.put("orderStatus", order.getOrderStatus().name());
            orderMetrics.put("paymentMethod", order.getPaymentMethod().name());
            orderMetrics.put("paymentStatus", order.getPaymentStatus().name());
            orderMetrics.put("createdAt", order.getCreatedAt());

            nodesById.put(orderNodeId, new GraphNodeDto(
                    orderNodeId,
                    GraphNodeType.ORDER.name(),
                    order.getOrderNumber(),
                    order.getOrderStatus().name() + " · " + order.getPaymentMethod().name() + " · ₹" + order.getTotalAmount(),
                    orderMetrics));

            edges.add(new GraphEdgeDto(
                    "edge:placed:" + profile.customerId() + ":" + order.getId(),
                    custNodeId,
                    orderNodeId,
                    GraphEdgeType.PLACED.name(),
                    "PLACED",
                    Map.of(
                            "orderNumber", order.getOrderNumber(),
                            "orderStatus", order.getOrderStatus().name(),
                            "paymentMethod", order.getPaymentMethod().name(),
                            "totalAmount", order.getTotalAmount())));

            // 3. Consolidated PRODUCT nodes & ORDER -> CONTAINS -> PRODUCT edges
            List<OrderItem> oItems = itemsByOrderId.getOrDefault(order.getId(), Collections.emptyList());
            for (OrderItem item : oItems) {
                String sku = normalizeSku(item.getSku(), item.getProductName());
                String prodNodeId = "product:" + sku;
                CustomerProductAgg agg = productAggBySku.get(sku);

                if (!nodesById.containsKey(prodNodeId) && agg != null) {
                    Map<String, Object> prodMetrics = new LinkedHashMap<>();
                    prodMetrics.put("productName", agg.productName);
                    prodMetrics.put("sku", agg.sku);
                    prodMetrics.put("unitsPurchased", agg.unitsPurchased);
                    prodMetrics.put("totalSpend", agg.totalSpend);
                    prodMetrics.put("ordersCount", agg.orderIds.size());

                    nodesById.put(prodNodeId, new GraphNodeDto(
                            prodNodeId,
                            GraphNodeType.PRODUCT.name(),
                            agg.productName,
                            agg.sku + " · " + agg.unitsPurchased + " unit(s)",
                            prodMetrics));
                }

                String edgeKey = order.getId() + "||" + sku;
                if (addedOrderProductEdgeKeys.add(edgeKey)) {
                    int unitsInThisOrder = oItems.stream()
                            .filter(i -> normalizeSku(i.getSku(), i.getProductName()).equals(sku))
                            .mapToInt(OrderItem::getQuantity)
                            .sum();
                    BigDecimal priceInThisOrder = oItems.stream()
                            .filter(i -> normalizeSku(i.getSku(), i.getProductName()).equals(sku))
                            .map(OrderItem::getTotalPrice)
                            .reduce(ZERO, BigDecimal::add);

                    edges.add(new GraphEdgeDto(
                            "edge:contains:" + order.getId() + ":" + sku,
                            orderNodeId,
                            prodNodeId,
                            GraphEdgeType.CONTAINS.name(),
                            "CONTAINS",
                            Map.of("quantity", unitsInThisOrder, "totalPrice", priceInThisOrder)));
                }
            }
        }

        List<GraphNodeDto> finalNodes = new ArrayList<>(nodesById.values());
        int ordCount = (int) finalNodes.stream().filter(n -> GraphNodeType.ORDER.name().equals(n.type())).count();
        int prodCount = (int) finalNodes.stream().filter(n -> GraphNodeType.PRODUCT.name().equals(n.type())).count();
        int segCount = (int) finalNodes.stream().filter(n -> GraphNodeType.SEGMENT.name().equals(n.type())).count();

        Map<String, Object> appliedFilters = new LinkedHashMap<>();
        appliedFilters.put("scope", "INDIVIDUAL_CUSTOMER");
        appliedFilters.put("customerId", profile.customerId().toString());

        GraphMetadataDto metadata = new GraphMetadataDto(
                finalNodes.size(),
                edges.size(),
                1,
                ordCount,
                prodCount,
                segCount,
                appliedFilters,
                false,
                finalNodes.size(),
                generatedAt);

        return new GraphResponseDto(finalNodes, edges, metadata);
    }

    private static boolean shouldIncludeNodeType(GraphNodeType filter, GraphNodeType candidate) {
        return filter == null || filter == candidate;
    }

    public static BigDecimal percentage(int numerator, int denominator) {
        if (denominator <= 0 || numerator <= 0) {
            return ZERO;
        }
        return BigDecimal.valueOf(numerator)
                .multiply(HUNDRED)
                .divide(BigDecimal.valueOf(denominator), 2, RoundingMode.HALF_UP);
    }
}
