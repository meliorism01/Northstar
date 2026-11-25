package com.ordexa.customer.intelligence;

import static org.assertj.core.api.Assertions.assertThat;

import com.ordexa.customer.entity.Customer;
import com.ordexa.customer.intelligence.analytics.CustomerIntelligenceCalculator;
import com.ordexa.customer.intelligence.config.CustomerIntelligenceProperties;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.CustomerIntelligenceProfileDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.CustomerOrderOutcomeDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.CustomerPaymentBehaviourDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.CustomerPurchaseMetricsDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.GraphResponseDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.ProductCoPurchaseDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.ProductIntelligenceDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.SegmentAssignmentDto;
import com.ordexa.customer.intelligence.segmentation.CustomerSegmentType;
import com.ordexa.order.entity.Order;
import com.ordexa.order.entity.OrderItem;
import com.ordexa.order.entity.OrderSource;
import com.ordexa.order.entity.OrderStatus;
import com.ordexa.order.entity.PaymentMethod;
import com.ordexa.order.entity.PaymentStatus;
import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class CustomerIntelligenceCalculatorUnitTest {

    private static final UUID MERCHANT_ID = UUID.randomUUID();
    private static final OffsetDateTime NOW = OffsetDateTime.of(2026, 11, 25, 12, 0, 0, 0, ZoneOffset.UTC);

    @Test
    void emptyCustomerHistoryProducesZeroMetricsAndNoSegments() {
        CustomerPurchaseMetricsDto purchase =
                CustomerIntelligenceCalculator.computePurchaseMetrics(List.of(), List.of(), NOW);
        CustomerPaymentBehaviourDto payment =
                CustomerIntelligenceCalculator.computePaymentBehaviour(List.of());
        CustomerOrderOutcomeDto outcomes =
                CustomerIntelligenceCalculator.computeOrderOutcomes(List.of());

        assertThat(purchase.totalOrders()).isZero();
        assertThat(purchase.totalSpend()).isEqualByComparingTo("0.00");
        assertThat(purchase.averageOrderValue()).isEqualByComparingTo("0.00");
        assertThat(purchase.daysSinceLastOrder()).isNull();
        assertThat(payment.codPercentage()).isEqualByComparingTo("0.00");
        assertThat(outcomes.cancellationPercentage()).isEqualByComparingTo("0.00");
        assertThat(outcomes.dataQualityNote()).contains("Return-to-Origin (RTO)");

        List<SegmentAssignmentDto> segments = CustomerIntelligenceCalculator.evaluateSegments(
                purchase,
                payment,
                outcomes,
                new BigDecimal("5000.00"),
                new CustomerIntelligenceProperties(),
                NOW);
        assertThat(segments).isEmpty();
    }

    @Test
    void singleOrderCustomerAssignedNewCustomerAndInactiveWhenOld() {
        Customer c = new Customer(UUID.randomUUID(), MERCHANT_ID, "Rohan Verma", "9876543210", "rohan@example.in");
        Order o1 = createOrder(
                c,
                "ORD-101",
                OrderStatus.DELIVERED,
                PaymentMethod.PREPAID,
                new BigDecimal("1499.00"),
                NOW.minusDays(45));
        OrderItem item1 = createItem(o1, "Vitamin C Serum", "SERUM-VITC", 1, new BigDecimal("1499.00"));

        CustomerPurchaseMetricsDto purchase =
                CustomerIntelligenceCalculator.computePurchaseMetrics(List.of(o1), List.of(item1), NOW);
        CustomerPaymentBehaviourDto payment =
                CustomerIntelligenceCalculator.computePaymentBehaviour(List.of(o1));
        CustomerOrderOutcomeDto outcomes =
                CustomerIntelligenceCalculator.computeOrderOutcomes(List.of(o1));

        assertThat(purchase.totalOrders()).isEqualTo(1);
        assertThat(purchase.totalSpend()).isEqualByComparingTo("1499.00");
        assertThat(purchase.averageOrderValue()).isEqualByComparingTo("1499.00");
        assertThat(purchase.daysSinceLastQualifyingOrder()).isEqualTo(45L);
        assertThat(payment.prepaidPercentage()).isEqualByComparingTo("100.00");

        List<SegmentAssignmentDto> segments = CustomerIntelligenceCalculator.evaluateSegments(
                purchase,
                payment,
                outcomes,
                new BigDecimal("5000.00"),
                new CustomerIntelligenceProperties(),
                NOW);
        Set<String> segIds = segments.stream().map(SegmentAssignmentDto::segmentId).collect(Collectors.toSet());
        assertThat(segIds).containsExactlyInAnyOrder(
                CustomerSegmentType.NEW_CUSTOMER.getSegmentId(),
                CustomerSegmentType.INACTIVE_CUSTOMER.getSegmentId());
    }

    @Test
    void multiOrderLoyalHighValueCodCustomerCalculatesMetricsAndExplainableSegments() {
        Customer c = new Customer(UUID.randomUUID(), MERCHANT_ID, "Ananya Iyer", "9811122233", "ananya@example.in");
        Order o1 = createOrder(
                c, "ORD-201", OrderStatus.DELIVERED, PaymentMethod.COD, new BigDecimal("2500.00"), NOW.minusDays(25));
        Order o2 = createOrder(
                c, "ORD-202", OrderStatus.DELIVERED, PaymentMethod.COD, new BigDecimal("3000.00"), NOW.minusDays(15));
        Order o3 = createOrder(
                c, "ORD-203", OrderStatus.CONFIRMED, PaymentMethod.COD, new BigDecimal("2000.00"), NOW.minusDays(5));

        List<Order> orders = List.of(o1, o2, o3);
        List<OrderItem> items = List.of(
                createItem(o1, "Kumkumadi Oil", "KUM-OIL-15", 1, new BigDecimal("2500.00")),
                createItem(o2, "Kumkumadi Oil", "KUM-OIL-15", 1, new BigDecimal("2500.00")),
                createItem(o2, "Rose Mist", "ROSE-MIST-100", 1, new BigDecimal("500.00")),
                createItem(o3, "Kumkumadi Oil", "KUM-OIL-15", 1, new BigDecimal("2000.00")));

        CustomerPurchaseMetricsDto purchase =
                CustomerIntelligenceCalculator.computePurchaseMetrics(orders, items, NOW);
        CustomerPaymentBehaviourDto payment =
                CustomerIntelligenceCalculator.computePaymentBehaviour(orders);
        CustomerOrderOutcomeDto outcomes =
                CustomerIntelligenceCalculator.computeOrderOutcomes(orders);

        assertThat(purchase.totalOrders()).isEqualTo(3);
        assertThat(purchase.nonCancelledOrders()).isEqualTo(3);
        assertThat(purchase.totalSpend()).isEqualByComparingTo("7500.00");
        assertThat(purchase.averageOrderValue()).isEqualByComparingTo("2500.00");
        assertThat(purchase.highestOrderValue()).isEqualByComparingTo("3000.00");
        assertThat(purchase.lowestOrderValue()).isEqualByComparingTo("2000.00");
        assertThat(purchase.repeatPurchaseCount()).isEqualTo(2);
        assertThat(purchase.distinctProductsPurchased()).isEqualTo(2);
        assertThat(purchase.averageDaysBetweenOrders()).isEqualByComparingTo("10.00");
        assertThat(payment.codPercentage()).isEqualByComparingTo("100.00");
        assertThat(outcomes.deliveredOrders()).isEqualTo(2);
        assertThat(outcomes.pendingOrders()).isEqualTo(1);
        assertThat(outcomes.cancellationPercentage()).isEqualByComparingTo("0.00");

        List<SegmentAssignmentDto> segments = CustomerIntelligenceCalculator.evaluateSegments(
                purchase,
                payment,
                outcomes,
                new BigDecimal("5000.00"),
                new CustomerIntelligenceProperties(),
                NOW);
        Set<String> segIds = segments.stream().map(SegmentAssignmentDto::segmentId).collect(Collectors.toSet());
        assertThat(segIds).contains(
                CustomerSegmentType.REPEAT_CUSTOMER.getSegmentId(),
                CustomerSegmentType.HIGH_VALUE_CUSTOMER.getSegmentId(),
                CustomerSegmentType.COD_HEAVY_CUSTOMER.getSegmentId(),
                CustomerSegmentType.LOYAL_CUSTOMER.getSegmentId());

        for (SegmentAssignmentDto seg : segments) {
            assertThat(seg.reason()).isNotBlank();
            assertThat(seg.thresholdApplied()).isNotBlank();
            assertThat(seg.evidence()).isNotEmpty();
        }
    }

    @Test
    void customerWithOnlyCancelledOrdersIsAssignedCancellationProneAndZeroQualifyingSpend() {
        Customer c = new Customer(UUID.randomUUID(), MERCHANT_ID, "Vikram Singh", "9899988877", null);
        Order o1 = createOrder(
                c, "ORD-301", OrderStatus.CANCELLED, PaymentMethod.COD, new BigDecimal("1800.00"), NOW.minusDays(10));
        Order o2 = createOrder(
                c, "ORD-302", OrderStatus.CANCELLED, PaymentMethod.PREPAID, new BigDecimal("2200.00"), NOW.minusDays(3));

        List<Order> orders = List.of(o1, o2);
        List<OrderItem> items = List.of(
                createItem(o1, "Hair Oil", "HAIR-OIL", 1, new BigDecimal("1800.00")),
                createItem(o2, "Hair Oil", "HAIR-OIL", 1, new BigDecimal("2200.00")));

        CustomerPurchaseMetricsDto purchase =
                CustomerIntelligenceCalculator.computePurchaseMetrics(orders, items, NOW);
        CustomerPaymentBehaviourDto payment =
                CustomerIntelligenceCalculator.computePaymentBehaviour(orders);
        CustomerOrderOutcomeDto outcomes =
                CustomerIntelligenceCalculator.computeOrderOutcomes(orders);

        assertThat(purchase.totalOrders()).isEqualTo(2);
        assertThat(purchase.nonCancelledOrders()).isZero();
        assertThat(purchase.totalSpend()).isEqualByComparingTo("0.00");
        assertThat(purchase.grossOrderValueIncludingCancelled()).isEqualByComparingTo("4000.00");
        assertThat(outcomes.cancelledOrders()).isEqualTo(2);
        assertThat(outcomes.cancellationPercentage()).isEqualByComparingTo("100.00");

        List<SegmentAssignmentDto> segments = CustomerIntelligenceCalculator.evaluateSegments(
                purchase,
                payment,
                outcomes,
                new BigDecimal("5000.00"),
                new CustomerIntelligenceProperties(),
                NOW);
        Set<String> segIds = segments.stream().map(SegmentAssignmentDto::segmentId).collect(Collectors.toSet());
        assertThat(segIds).contains(
                CustomerSegmentType.REPEAT_CUSTOMER.getSegmentId(),
                CustomerSegmentType.CANCELLATION_PRONE_CUSTOMER.getSegmentId());
        assertThat(segIds).doesNotContain(
                CustomerSegmentType.HIGH_VALUE_CUSTOMER.getSegmentId(),
                CustomerSegmentType.LOYAL_CUSTOMER.getSegmentId());
    }

    @Test
    void productCoPurchaseAndGraphGenerationLinksCustomersOrdersProductsAndSharedPeers() {
        Customer c1 = new Customer(UUID.randomUUID(), MERCHANT_ID, "Priya Nair", "9811100011", "priya@example.in");
        Customer c2 = new Customer(UUID.randomUUID(), MERCHANT_ID, "Kabir Mehta", "9811100022", "kabir@example.in");

        Order o1 = createOrder(
                c1, "ORD-401", OrderStatus.DELIVERED, PaymentMethod.UPI, new BigDecimal("1500.00"), NOW.minusDays(12));
        Order o2 = createOrder(
                c1, "ORD-402", OrderStatus.DELIVERED, PaymentMethod.UPI, new BigDecimal("900.00"), NOW.minusDays(4));
        Order o3 = createOrder(
                c2, "ORD-403", OrderStatus.CONFIRMED, PaymentMethod.COD, new BigDecimal("1500.00"), NOW.minusDays(2));

        List<OrderItem> allItems = List.of(
                createItem(o1, "Vitamin C Serum", "serum-vitc", 1, new BigDecimal("900.00")),
                createItem(o1, "Sunscreen SPF 50", "SPF-50", 1, new BigDecimal("600.00")),
                createItem(o2, "Vitamin C Serum", "SERUM-VITC", 1, new BigDecimal("900.00")),
                createItem(o3, "Vitamin C Serum", "SERUM-VITC", 1, new BigDecimal("900.00")),
                createItem(o3, "Sunscreen SPF 50", "SPF-50", 1, new BigDecimal("600.00")));

        List<ProductIntelligenceDto> products = CustomerIntelligenceCalculator.computeProductAnalytics(allItems);
        assertThat(products).hasSize(2);

        ProductIntelligenceDto serum = products.stream()
                .filter(p -> p.sku().equals("SERUM-VITC"))
                .findFirst()
                .orElseThrow();
        assertThat(serum.unitsPurchased()).isEqualTo(3);
        assertThat(serum.totalRevenue()).isEqualByComparingTo("2700.00");
        assertThat(serum.uniqueCustomers()).isEqualTo(2);
        assertThat(serum.repeatCustomerCount()).isEqualTo(1);

        List<ProductCoPurchaseDto> coPurchases =
                CustomerIntelligenceCalculator.computeCoPurchases(allItems, 1, 10);
        assertThat(coPurchases).hasSize(1);
        ProductCoPurchaseDto pair = coPurchases.get(0);
        assertThat(pair.skuA()).isEqualTo("SERUM-VITC");
        assertThat(pair.skuB()).isEqualTo("SPF-50");
        assertThat(pair.coPurchaseOrderCount()).isEqualTo(2);
        assertThat(pair.sharedCustomerCount()).isEqualTo(2);

        CustomerIntelligenceProfileDto p1 = buildProfile(c1, List.of(o1, o2), allItems.subList(0, 3));
        CustomerIntelligenceProfileDto p2 = buildProfile(c2, List.of(o3), allItems.subList(3, 5));

        GraphResponseDto graph = CustomerIntelligenceCalculator.buildGraph(
                List.of(p1, p2),
                List.of(o1, o2, o3),
                allItems,
                products,
                null,
                null,
                null,
                null,
                100,
                NOW);

        assertThat(graph.metadata().customerNodes()).isEqualTo(2);
        assertThat(graph.metadata().orderNodes()).isEqualTo(3);
        assertThat(graph.metadata().productNodes()).isEqualTo(2);
        assertThat(graph.metadata().segmentNodes()).isGreaterThanOrEqualTo(2);

        Set<String> edgeTypes = graph.edges().stream().map(e -> e.type()).collect(Collectors.toSet());
        assertThat(edgeTypes).contains(
                "PLACED",
                "CONTAINS",
                "BELONGS_TO",
                "REPEATEDLY_PURCHASED",
                "RELATED_TO");

        // Verify Individual Customer Graph contains strictly 1 CUSTOMER node and consolidates repeated SKUs
        GraphResponseDto individualGraph = CustomerIntelligenceCalculator.buildIndividualCustomerGraph(
                p1,
                List.of(o1, o2),
                allItems.subList(0, 3),
                NOW);
        assertThat(individualGraph.metadata().customerNodes()).isEqualTo(1);
        assertThat(individualGraph.metadata().orderNodes()).isEqualTo(2);
        assertThat(individualGraph.metadata().productNodes()).isEqualTo(2);
        assertThat(individualGraph.nodes().stream().filter(n -> "CUSTOMER".equals(n.type())).count()).isEqualTo(1);
        assertThat(individualGraph.nodes()).noneMatch(n -> n.id().equals("customer:" + c2.getId()));
        assertThat(individualGraph.nodes()).noneMatch(n -> n.id().equals("order:" + o3.getId()));

        Set<String> individualEdgeTypes = individualGraph.edges().stream().map(e -> e.type()).collect(Collectors.toSet());
        assertThat(individualEdgeTypes).containsExactlyInAnyOrder("PLACED", "CONTAINS", "BELONGS_TO");
    }

    private static CustomerIntelligenceProfileDto buildProfile(
            Customer c,
            List<Order> orders,
            List<OrderItem> items) {
        CustomerPurchaseMetricsDto pm =
                CustomerIntelligenceCalculator.computePurchaseMetrics(orders, items, NOW);
        CustomerPaymentBehaviourDto pay =
                CustomerIntelligenceCalculator.computePaymentBehaviour(orders);
        CustomerOrderOutcomeDto out =
                CustomerIntelligenceCalculator.computeOrderOutcomes(orders);
        List<SegmentAssignmentDto> segs = CustomerIntelligenceCalculator.evaluateSegments(
                pm, pay, out, new BigDecimal("5000.00"), new CustomerIntelligenceProperties(), NOW);
        List<String> segIds = segs.stream().map(SegmentAssignmentDto::segmentId).toList();
        return new CustomerIntelligenceProfileDto(
                c.getId(),
                c.getMerchantId(),
                c.getFullName(),
                c.getPhoneNumber(),
                c.getEmail(),
                NOW.minusDays(30),
                pm,
                pay,
                out,
                segs,
                segIds,
                CustomerIntelligenceCalculator.selectPrimarySegment(segs),
                NOW);
    }

    private static Order createOrder(
            Customer customer,
            String orderNumber,
            OrderStatus status,
            PaymentMethod paymentMethod,
            BigDecimal totalAmount,
            OffsetDateTime createdAt) {
        Order order = new Order(
                UUID.randomUUID(),
                MERCHANT_ID,
                orderNumber,
                customer,
                OrderSource.MANUAL,
                status,
                status == OrderStatus.DELIVERED ? PaymentStatus.PAID : PaymentStatus.PENDING,
                paymentMethod,
                totalAmount,
                BigDecimal.ZERO.setScale(2),
                BigDecimal.ZERO.setScale(2),
                totalAmount,
                "INR",
                "100 MG Road, Bengaluru",
                "100 MG Road, Bengaluru",
                null);
        setCreatedAt(order, createdAt);
        return order;
    }

    private static OrderItem createItem(
            Order order,
            String productName,
            String sku,
            int qty,
            BigDecimal unitPrice) {
        return new OrderItem(
                UUID.randomUUID(),
                MERCHANT_ID,
                order,
                productName,
                sku,
                qty,
                unitPrice,
                unitPrice.multiply(BigDecimal.valueOf(qty)));
    }

    private static void setCreatedAt(Order order, OffsetDateTime timestamp) {
        try {
            Field f = Order.class.getDeclaredField("createdAt");
            f.setAccessible(true);
            f.set(order, timestamp);
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }
    }
}
