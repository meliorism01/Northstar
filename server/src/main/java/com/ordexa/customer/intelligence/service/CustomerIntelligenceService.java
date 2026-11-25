package com.ordexa.customer.intelligence.service;

import com.ordexa.common.exception.ErrorCode;
import com.ordexa.common.exception.OrdexaException;
import com.ordexa.common.exception.ResourceNotFoundException;
import com.ordexa.common.response.PagedResponse;
import com.ordexa.common.validation.PaginationValidator;
import com.ordexa.customer.entity.Customer;
import com.ordexa.customer.intelligence.analytics.CustomerIntelligenceCalculator;
import com.ordexa.customer.intelligence.config.CustomerIntelligenceProperties;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.Customer360Dto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.CustomerIntelligenceProfileDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.CustomerOrderOutcomeDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.CustomerPaymentBehaviourDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.CustomerProductPreferenceDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.CustomerPurchaseMetricsDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.CustomerRelationshipSummaryDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.CustomerTimelineEventDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.GraphResponseDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.IntelligenceOverviewDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.ProductCoPurchaseDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.ProductCustomerBuyerDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.ProductDetailIntelligenceDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.ProductIntelligenceDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.RelatedCustomerSummaryDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.SegmentAssignmentDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.SegmentSummaryDto;
import com.ordexa.customer.intelligence.entity.CustomerBehaviouralEvent;
import com.ordexa.customer.intelligence.graph.GraphNodeType;
import com.ordexa.customer.intelligence.repository.CustomerBehaviouralEventRepository;
import com.ordexa.customer.intelligence.segmentation.CustomerSegmentType;
import com.ordexa.customer.repository.CustomerRepository;
import com.ordexa.order.entity.Order;
import com.ordexa.order.entity.OrderItem;
import com.ordexa.order.entity.OrderStatus;
import com.ordexa.order.entity.OrderStatusHistory;
import com.ordexa.order.repository.OrderItemRepository;
import com.ordexa.order.repository.OrderRepository;
import com.ordexa.order.repository.OrderStatusHistoryRepository;
import com.ordexa.tenant.context.TenantContext;
import com.ordexa.tenant.context.TenantContextHolder;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerIntelligenceService {

    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

    private final CustomerRepository customerRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final OrderStatusHistoryRepository statusHistoryRepository;
    private final CustomerBehaviouralEventRepository behaviouralEventRepository;
    private final CustomerIntelligenceProperties properties;
    private final Clock clock;

    public CustomerIntelligenceService(
            CustomerRepository customerRepository,
            OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            OrderStatusHistoryRepository statusHistoryRepository,
            CustomerBehaviouralEventRepository behaviouralEventRepository,
            CustomerIntelligenceProperties properties,
            Clock clock) {
        this.customerRepository = customerRepository;
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.statusHistoryRepository = statusHistoryRepository;
        this.behaviouralEventRepository = behaviouralEventRepository;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public IntelligenceOverviewDto getOverview() {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        OffsetDateTime now = OffsetDateTime.now(clock);
        MerchantDataset dataset = loadMerchantDataset(ctx.merchantId(), null, null, now);

        int totalCustomers = dataset.profiles.size();
        int newCustomers = countCustomersInSegment(dataset.profiles, CustomerSegmentType.NEW_CUSTOMER);
        int repeatCustomers = countCustomersInSegment(dataset.profiles, CustomerSegmentType.REPEAT_CUSTOMER);
        int highValueCustomers = countCustomersInSegment(dataset.profiles, CustomerSegmentType.HIGH_VALUE_CUSTOMER);
        int inactiveCustomers = countCustomersInSegment(dataset.profiles, CustomerSegmentType.INACTIVE_CUSTOMER);
        int cancelProneCustomers = countCustomersInSegment(dataset.profiles, CustomerSegmentType.CANCELLATION_PRONE_CUSTOMER);
        int codHeavyCustomers = countCustomersInSegment(dataset.profiles, CustomerSegmentType.COD_HEAVY_CUSTOMER);
        int loyalCustomers = countCustomersInSegment(dataset.profiles, CustomerSegmentType.LOYAL_CUSTOMER);

        int totalOrders = dataset.orders.size();
        int deliveredOrders = 0;
        int cancelledOrders = 0;
        int pendingOrders = 0;
        BigDecimal totalQualifyingRevenue = ZERO;
        int nonCancelledOrders = 0;

        for (Order o : dataset.orders) {
            if (o.getOrderStatus() == OrderStatus.DELIVERED) {
                deliveredOrders++;
            } else if (o.getOrderStatus() == OrderStatus.CANCELLED) {
                cancelledOrders++;
            } else {
                pendingOrders++;
            }
            if (o.getOrderStatus() != OrderStatus.CANCELLED) {
                nonCancelledOrders++;
                totalQualifyingRevenue = totalQualifyingRevenue.add(o.getTotalAmount().setScale(2, RoundingMode.HALF_UP));
            }
        }

        BigDecimal avgClv = totalCustomers > 0
                ? totalQualifyingRevenue.divide(BigDecimal.valueOf(totalCustomers), 2, RoundingMode.HALF_UP)
                : ZERO;
        BigDecimal avgOrderValue = nonCancelledOrders > 0
                ? totalQualifyingRevenue.divide(BigDecimal.valueOf(nonCancelledOrders), 2, RoundingMode.HALF_UP)
                : ZERO;
        BigDecimal repeatPurchaseRate = CustomerIntelligenceCalculator.percentage(repeatCustomers, totalCustomers);
        BigDecimal cancellationRate = CustomerIntelligenceCalculator.percentage(cancelledOrders, totalOrders);

        List<ProductIntelligenceDto> products =
                CustomerIntelligenceCalculator.computeProductAnalytics(dataset.orderItems);
        List<SegmentSummaryDto> segmentSummaries = buildSegmentSummaries(dataset.profiles, dataset.highValueThreshold, now);

        return new IntelligenceOverviewDto(
                totalCustomers,
                newCustomers,
                repeatCustomers,
                highValueCustomers,
                inactiveCustomers,
                cancelProneCustomers,
                codHeavyCustomers,
                loyalCustomers,
                totalOrders,
                deliveredOrders,
                cancelledOrders,
                pendingOrders,
                totalQualifyingRevenue,
                avgClv,
                avgOrderValue,
                repeatPurchaseRate,
                cancellationRate,
                products.size(),
                segmentSummaries,
                now);
    }

    @Transactional(readOnly = true)
    public GraphResponseDto getGraph(
            String nodeTypeRaw,
            UUID customerId,
            String productSku,
            String segment,
            OffsetDateTime fromDate,
            OffsetDateTime toDate,
            int limit) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        OffsetDateTime now = OffsetDateTime.now(clock);

        GraphNodeType nodeType = null;
        if (nodeTypeRaw != null && !nodeTypeRaw.isBlank() && !"ALL".equalsIgnoreCase(nodeTypeRaw.trim())) {
            try {
                nodeType = GraphNodeType.valueOf(nodeTypeRaw.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException ex) {
                throw new OrdexaException(
                        "Invalid graph nodeType filter: " + nodeTypeRaw,
                        ErrorCode.VALIDATION_ERROR,
                        HttpStatus.BAD_REQUEST);
            }
        }

        if (customerId != null) {
            customerRepository.findByIdAndMerchantId(customerId, ctx.merchantId())
                    .orElseThrow(() -> new ResourceNotFoundException("Customer not found in active merchant workspace"));
        }

        MerchantDataset dataset = loadMerchantDataset(ctx.merchantId(), fromDate, toDate, now);
        List<ProductIntelligenceDto> products =
                CustomerIntelligenceCalculator.computeProductAnalytics(dataset.orderItems);

        return CustomerIntelligenceCalculator.buildGraph(
                dataset.profiles,
                dataset.orders,
                dataset.orderItems,
                products,
                nodeType,
                customerId,
                productSku,
                segment,
                limit,
                now);
    }

    @Transactional(readOnly = true)
    public PagedResponse<CustomerIntelligenceProfileDto> listIntelligentCustomers(
            String search,
            String segment,
            Integer minOrders,
            Integer maxOrders,
            BigDecimal minSpend,
            Long maxDaysSinceLastOrder,
            String sortBy,
            String sortDir,
            int page,
            int size) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        PaginationValidator.validate(page, size);
        OffsetDateTime now = OffsetDateTime.now(clock);

        MerchantDataset dataset = loadMerchantDataset(ctx.merchantId(), null, null, now);

        String searchNorm = (search != null && !search.isBlank())
                ? search.trim().toLowerCase(Locale.ROOT)
                : null;
        String segmentNorm = (segment != null && !segment.isBlank() && !"ALL".equalsIgnoreCase(segment.trim()))
                ? segment.trim().toUpperCase(Locale.ROOT)
                : null;

        List<CustomerIntelligenceProfileDto> filtered = dataset.profiles.stream()
                .filter(p -> {
                    if (searchNorm != null) {
                        boolean nameMatch = p.fullName().toLowerCase(Locale.ROOT).contains(searchNorm);
                        boolean phoneMatch = p.phoneNumber().toLowerCase(Locale.ROOT).contains(searchNorm);
                        boolean emailMatch = p.email() != null && p.email().toLowerCase(Locale.ROOT).contains(searchNorm);
                        if (!nameMatch && !phoneMatch && !emailMatch) {
                            return false;
                        }
                    }
                    if (segmentNorm != null && !p.segmentIds().contains(segmentNorm)) {
                        return false;
                    }
                    if (minOrders != null && p.purchaseMetrics().totalOrders() < minOrders) {
                        return false;
                    }
                    if (maxOrders != null && p.purchaseMetrics().totalOrders() > maxOrders) {
                        return false;
                    }
                    if (minSpend != null && p.purchaseMetrics().totalSpend().compareTo(minSpend) < 0) {
                        return false;
                    }
                    if (maxDaysSinceLastOrder != null) {
                        Long days = p.purchaseMetrics().daysSinceLastOrder();
                        if (days == null || days > maxDaysSinceLastOrder) {
                            return false;
                        }
                    }
                    return true;
                })
                .sorted(buildProfileComparator(sortBy, sortDir))
                .toList();

        return paginateList(filtered, page, size);
    }

    @Transactional(readOnly = true)
    public Customer360Dto getCustomer360(UUID customerId) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        OffsetDateTime now = OffsetDateTime.now(clock);

        Customer customer = customerRepository.findByIdAndMerchantId(customerId, ctx.merchantId())
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found in active merchant workspace"));

        MerchantDataset dataset = loadMerchantDataset(ctx.merchantId(), null, null, now);
        CustomerIntelligenceProfileDto profile = dataset.profiles.stream()
                .filter(p -> p.customerId().equals(customer.getId()))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Customer intelligence profile not found"));

        List<Order> customerOrders = dataset.ordersByCustomerId.getOrDefault(customerId, Collections.emptyList());
        List<OrderItem> customerItems = dataset.itemsByCustomerId.getOrDefault(customerId, Collections.emptyList());

        List<CustomerProductPreferenceDto> preferences =
                CustomerIntelligenceCalculator.computeCustomerProductPreferences(
                        customerOrders,
                        customerItems,
                        profile.purchaseMetrics().totalSpend());

        List<CustomerTimelineEventDto> timeline = buildCustomerTimeline(ctx.merchantId(), customerId, customerOrders);

        List<RelatedCustomerSummaryDto> sharedCustomers =
                CustomerIntelligenceCalculator.computeSharedProductCustomers(customerId, dataset.orderItems);

        CustomerRelationshipSummaryDto relationships = new CustomerRelationshipSummaryDto(
                customerOrders.size(),
                preferences.size(),
                profile.segments().size(),
                sharedCustomers.size(),
                sharedCustomers);

        GraphResponseDto subgraph = CustomerIntelligenceCalculator.buildIndividualCustomerGraph(
                profile,
                customerOrders,
                customerItems,
                now);

        return new Customer360Dto(profile, preferences, timeline, relationships, subgraph);
    }

    @Transactional(readOnly = true)
    public GraphResponseDto getCustomerGraph(UUID customerId) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        OffsetDateTime now = OffsetDateTime.now(clock);

        Customer customer = customerRepository.findByIdAndMerchantId(customerId, ctx.merchantId())
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found in active merchant workspace"));

        MerchantDataset dataset = loadMerchantDataset(ctx.merchantId(), null, null, now);
        CustomerIntelligenceProfileDto profile = dataset.profiles.stream()
                .filter(p -> p.customerId().equals(customer.getId()))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Customer intelligence profile not found"));

        List<Order> customerOrders = dataset.ordersByCustomerId.getOrDefault(customerId, Collections.emptyList());
        List<OrderItem> customerItems = dataset.itemsByCustomerId.getOrDefault(customerId, Collections.emptyList());

        return CustomerIntelligenceCalculator.buildIndividualCustomerGraph(
                profile,
                customerOrders,
                customerItems,
                now);
    }

    @Transactional(readOnly = true)
    public List<SegmentAssignmentDto> getCustomerSegments(UUID customerId) {
        return getCustomer360(customerId).profile().segments();
    }

    @Transactional(readOnly = true)
    public List<CustomerTimelineEventDto> getCustomerTimeline(UUID customerId) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        Customer customer = customerRepository.findByIdAndMerchantId(customerId, ctx.merchantId())
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found in active merchant workspace"));
        List<Order> customerOrders = orderRepository
                .findByMerchantIdAndCustomerIdOrderByCreatedAtDesc(ctx.merchantId(), customer.getId());
        return buildCustomerTimeline(ctx.merchantId(), customer.getId(), customerOrders);
    }

    @Transactional(readOnly = true)
    public List<CustomerProductPreferenceDto> getCustomerProducts(UUID customerId) {
        return getCustomer360(customerId).productPreferences();
    }

    @Transactional(readOnly = true)
    public List<SegmentSummaryDto> listSegments() {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        OffsetDateTime now = OffsetDateTime.now(clock);
        MerchantDataset dataset = loadMerchantDataset(ctx.merchantId(), null, null, now);
        return buildSegmentSummaries(dataset.profiles, dataset.highValueThreshold, now);
    }

    @Transactional(readOnly = true)
    public SegmentSummaryDto getSegmentDetail(String segmentId) {
        CustomerSegmentType type = parseSegmentOrThrow(segmentId);
        return listSegments().stream()
                .filter(s -> s.segmentId().equalsIgnoreCase(type.getSegmentId()))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Segment not found: " + segmentId));
    }

    @Transactional(readOnly = true)
    public PagedResponse<CustomerIntelligenceProfileDto> listSegmentCustomers(
            String segmentId,
            int page,
            int size) {
        CustomerSegmentType type = parseSegmentOrThrow(segmentId);
        return listIntelligentCustomers(null, type.getSegmentId(), null, null, null, null, "totalSpend", "desc", page, size);
    }

    @Transactional(readOnly = true)
    public PagedResponse<ProductIntelligenceDto> listProducts(
            String search,
            String sortBy,
            int page,
            int size) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        PaginationValidator.validate(page, size);

        List<OrderItem> allItems = orderItemRepository.findAllByMerchantIdWithOrderAndCustomer(ctx.merchantId());
        List<ProductIntelligenceDto> products = CustomerIntelligenceCalculator.computeProductAnalytics(allItems);

        String searchNorm = (search != null && !search.isBlank())
                ? search.trim().toLowerCase(Locale.ROOT)
                : null;

        Comparator<ProductIntelligenceDto> comp = switch (sortBy != null ? sortBy : "totalRevenue") {
            case "unitsPurchased" -> Comparator.comparing(ProductIntelligenceDto::unitsPurchased).reversed();
            case "uniqueCustomers" -> Comparator.comparing(ProductIntelligenceDto::uniqueCustomers).reversed();
            case "repeatCustomerCount" -> Comparator.comparing(ProductIntelligenceDto::repeatCustomerCount).reversed();
            default -> Comparator.comparing(ProductIntelligenceDto::totalRevenue).reversed();
        };

        List<ProductIntelligenceDto> filtered = products.stream()
                .filter(p -> searchNorm == null
                        || p.productName().toLowerCase(Locale.ROOT).contains(searchNorm)
                        || p.sku().toLowerCase(Locale.ROOT).contains(searchNorm))
                .sorted(comp)
                .toList();

        return paginateList(filtered, page, size);
    }

    @Transactional(readOnly = true)
    public ProductDetailIntelligenceDto getProductDetail(String sku) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        String normalizedSku = CustomerIntelligenceCalculator.normalizeSku(sku, null);

        List<OrderItem> allItems = orderItemRepository.findAllByMerchantIdWithOrderAndCustomer(ctx.merchantId());
        List<ProductIntelligenceDto> products = CustomerIntelligenceCalculator.computeProductAnalytics(allItems);

        ProductIntelligenceDto product = products.stream()
                .filter(p -> p.sku().equalsIgnoreCase(normalizedSku))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Product SKU not found in active merchant workspace: " + sku));

        List<ProductCustomerBuyerDto> buyers =
                CustomerIntelligenceCalculator.computeProductBuyers(normalizedSku, allItems);
        List<ProductCoPurchaseDto> coPurchases =
                CustomerIntelligenceCalculator.computeCoPurchases(allItems, 1, 50).stream()
                        .filter(cp -> cp.skuA().equalsIgnoreCase(normalizedSku) || cp.skuB().equalsIgnoreCase(normalizedSku))
                        .toList();

        return new ProductDetailIntelligenceDto(product, buyers, coPurchases);
    }

    @Transactional(readOnly = true)
    public List<ProductCoPurchaseDto> listProductCoPurchases(int minCoPurchases, int limit) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        List<OrderItem> allItems = orderItemRepository.findAllByMerchantIdWithOrderAndCustomer(ctx.merchantId());
        return CustomerIntelligenceCalculator.computeCoPurchases(allItems, minCoPurchases, Math.min(100, Math.max(1, limit)));
    }

    private List<CustomerTimelineEventDto> buildCustomerTimeline(
            UUID merchantId,
            UUID customerId,
            List<Order> customerOrders) {
        Map<UUID, Order> orderById = customerOrders.stream()
                .collect(Collectors.toMap(Order::getId, o -> o, (a, b) -> a));

        List<CustomerTimelineEventDto> events = new ArrayList<>();

        List<OrderStatusHistory> statusHistories =
                statusHistoryRepository.findByMerchantIdAndCustomerIdOrderByCreatedAtDesc(merchantId, customerId);
        for (OrderStatusHistory h : statusHistories) {
            Order ord = h.getOrder();
            String eventType = "ORDER_" + h.getNewStatus().name();
            String title = switch (h.getNewStatus()) {
                case CREATED -> "Order " + ord.getOrderNumber() + " placed";
                case CONFIRMED -> "Order " + ord.getOrderNumber() + " confirmed";
                case PROCESSING -> "Order " + ord.getOrderNumber() + " entered processing";
                case SHIPPED -> "Order " + ord.getOrderNumber() + " shipped";
                case DELIVERED -> "Order " + ord.getOrderNumber() + " delivered";
                case CANCELLED -> "Order " + ord.getOrderNumber() + " cancelled";
            };
            events.add(new CustomerTimelineEventDto(
                    "history:" + h.getId(),
                    eventType,
                    "ORDER_LIFECYCLE",
                    ord.getId(),
                    ord.getOrderNumber(),
                    title,
                    h.getReason(),
                    h.getChangedBy(),
                    ord.getTotalAmount(),
                    ord.getCurrency(),
                    h.getCreatedAt()));
        }

        List<CustomerBehaviouralEvent> behaviouralEvents =
                behaviouralEventRepository.findByMerchantIdAndCustomerIdOrderByOccurredAtDesc(merchantId, customerId);
        for (CustomerBehaviouralEvent be : behaviouralEvents) {
            Order ord = be.getOrderId() != null ? orderById.get(be.getOrderId()) : null;
            events.add(new CustomerTimelineEventDto(
                    "event:" + be.getId(),
                    be.getEventType().name(),
                    "CUSTOMER_BEHAVIOUR",
                    be.getOrderId(),
                    ord != null ? ord.getOrderNumber() : null,
                    be.getTitle(),
                    be.getDescription(),
                    "SYSTEM",
                    ord != null ? ord.getTotalAmount() : null,
                    ord != null ? ord.getCurrency() : "INR",
                    be.getOccurredAt()));
        }

        return events.stream()
                .sorted(Comparator.comparing(CustomerTimelineEventDto::occurredAt).reversed())
                .toList();
    }

    private MerchantDataset loadMerchantDataset(
            UUID merchantId,
            OffsetDateTime fromDate,
            OffsetDateTime toDate,
            OffsetDateTime now) {
        List<Customer> customers = customerRepository.findByMerchantIdOrderByCreatedAtDesc(merchantId);
        List<Order> allOrders = orderRepository.findAllByMerchantIdWithCustomerOrderByCreatedAtDesc(merchantId);
        List<OrderItem> allItems = orderItemRepository.findAllByMerchantIdWithOrderAndCustomer(merchantId);

        List<Order> filteredOrders = allOrders.stream()
                .filter(o -> (fromDate == null || !o.getCreatedAt().isBefore(fromDate))
                        && (toDate == null || !o.getCreatedAt().isAfter(toDate)))
                .toList();
        Map<UUID, Order> allowedOrderMap = filteredOrders.stream()
                .collect(Collectors.toMap(Order::getId, o -> o));

        List<OrderItem> filteredItems = allItems.stream()
                .filter(i -> allowedOrderMap.containsKey(i.getOrder().getId()))
                .toList();

        Map<UUID, List<Order>> ordersByCustomer = filteredOrders.stream()
                .collect(Collectors.groupingBy(o -> o.getCustomer().getId()));
        Map<UUID, List<OrderItem>> itemsByCustomer = filteredItems.stream()
                .collect(Collectors.groupingBy(i -> i.getOrder().getCustomer().getId()));

        Map<UUID, CustomerPurchaseMetricsDto> purchaseByCustomer = new LinkedHashMap<>();
        Map<UUID, CustomerPaymentBehaviourDto> paymentByCustomer = new LinkedHashMap<>();
        Map<UUID, CustomerOrderOutcomeDto> outcomesByCustomer = new LinkedHashMap<>();
        List<BigDecimal> allQualifyingSpends = new ArrayList<>();

        for (Customer c : customers) {
            List<Order> cOrders = ordersByCustomer.getOrDefault(c.getId(), Collections.emptyList());
            List<OrderItem> cItems = itemsByCustomer.getOrDefault(c.getId(), Collections.emptyList());
            CustomerPurchaseMetricsDto pm =
                    CustomerIntelligenceCalculator.computePurchaseMetrics(cOrders, cItems, now);
            CustomerPaymentBehaviourDto pay =
                    CustomerIntelligenceCalculator.computePaymentBehaviour(cOrders);
            CustomerOrderOutcomeDto out =
                    CustomerIntelligenceCalculator.computeOrderOutcomes(cOrders);

            purchaseByCustomer.put(c.getId(), pm);
            paymentByCustomer.put(c.getId(), pay);
            outcomesByCustomer.put(c.getId(), out);
            allQualifyingSpends.add(pm.totalSpend());
        }

        BigDecimal highValueThreshold =
                CustomerIntelligenceCalculator.computeHighValueThreshold(allQualifyingSpends, properties);

        List<CustomerIntelligenceProfileDto> profiles = new ArrayList<>();
        for (Customer c : customers) {
            CustomerPurchaseMetricsDto pm = purchaseByCustomer.get(c.getId());
            CustomerPaymentBehaviourDto pay = paymentByCustomer.get(c.getId());
            CustomerOrderOutcomeDto out = outcomesByCustomer.get(c.getId());

            List<SegmentAssignmentDto> segments = CustomerIntelligenceCalculator.evaluateSegments(
                    pm, pay, out, highValueThreshold, properties, now);
            List<String> segmentIds = segments.stream().map(SegmentAssignmentDto::segmentId).toList();
            String primarySegment = CustomerIntelligenceCalculator.selectPrimarySegment(segments);

            profiles.add(new CustomerIntelligenceProfileDto(
                    c.getId(),
                    c.getMerchantId(),
                    c.getFullName(),
                    c.getPhoneNumber(),
                    c.getEmail(),
                    c.getCreatedAt(),
                    pm,
                    pay,
                    out,
                    segments,
                    segmentIds,
                    primarySegment,
                    now));
        }

        return new MerchantDataset(
                customers,
                filteredOrders,
                filteredItems,
                ordersByCustomer,
                itemsByCustomer,
                profiles,
                highValueThreshold);
    }

    private List<SegmentSummaryDto> buildSegmentSummaries(
            List<CustomerIntelligenceProfileDto> profiles,
            BigDecimal highValueThreshold,
            OffsetDateTime now) {
        int totalCustomers = profiles.size();
        List<SegmentSummaryDto> summaries = new ArrayList<>();

        for (CustomerSegmentType type : CustomerSegmentType.values()) {
            List<CustomerIntelligenceProfileDto> members = profiles.stream()
                    .filter(p -> p.segmentIds().contains(type.getSegmentId()))
                    .toList();
            int count = members.size();
            BigDecimal pct = CustomerIntelligenceCalculator.percentage(count, totalCustomers);
            BigDecimal totalSpend = members.stream()
                    .map(p -> p.purchaseMetrics().totalSpend())
                    .reduce(ZERO, BigDecimal::add);
            BigDecimal avgSpend = count > 0
                    ? totalSpend.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP)
                    : ZERO;

            String rule = switch (type) {
                case NEW_CUSTOMER -> "totalOrders == 1";
                case REPEAT_CUSTOMER -> "totalOrders >= 2";
                case HIGH_VALUE_CUSTOMER -> "totalSpend >= INR " + highValueThreshold + " (P" + properties.getHighValuePercentile() + ")";
                case INACTIVE_CUSTOMER -> "daysSinceLastQualifyingOrder > " + properties.getInactiveDaysThreshold() + " days";
                case CANCELLATION_PRONE_CUSTOMER -> "totalOrders >= " + properties.getMinOrdersForRateSegments()
                        + " AND cancellationPercentage >= " + properties.getCancellationProneThresholdPercent() + "%";
                case COD_HEAVY_CUSTOMER -> "totalOrders >= " + properties.getMinOrdersForRateSegments()
                        + " AND codPercentage >= " + properties.getCodHeavyThresholdPercent() + "%";
                case LOYAL_CUSTOMER -> "nonCancelledOrders >= " + properties.getLoyalMinNonCancelledOrders()
                        + " AND deliveredOrders >= 1 AND cancellationPercentage <= " + properties.getLoyalMaxCancellationPercent() + "%";
            };

            summaries.add(new SegmentSummaryDto(
                    type.getSegmentId(),
                    type.getDisplayName(),
                    type.getDescription(),
                    rule,
                    count,
                    pct,
                    totalSpend,
                    avgSpend,
                    now));
        }
        return summaries;
    }

    private static int countCustomersInSegment(
            List<CustomerIntelligenceProfileDto> profiles,
            CustomerSegmentType segmentType) {
        return (int) profiles.stream()
                .filter(p -> p.segmentIds().contains(segmentType.getSegmentId()))
                .count();
    }

    private static CustomerSegmentType parseSegmentOrThrow(String rawSegmentId) {
        try {
            return CustomerSegmentType.fromIdOrThrow(rawSegmentId);
        } catch (IllegalArgumentException ex) {
            throw new ResourceNotFoundException("Customer segment not found: " + rawSegmentId);
        }
    }

    private static Comparator<CustomerIntelligenceProfileDto> buildProfileComparator(String sortBy, String sortDir) {
        boolean asc = "asc".equalsIgnoreCase(sortDir);
        Comparator<CustomerIntelligenceProfileDto> base = switch (sortBy != null ? sortBy : "totalSpend") {
            case "totalOrders" -> Comparator.comparing(p -> p.purchaseMetrics().totalOrders());
            case "averageOrderValue" -> Comparator.comparing(p -> p.purchaseMetrics().averageOrderValue());
            case "lastOrderAt" -> Comparator.comparing(
                    p -> p.purchaseMetrics().lastOrderAt() != null
                            ? p.purchaseMetrics().lastOrderAt()
                            : p.registeredAt());
            case "cancellationPercentage" -> Comparator.comparing(p -> p.orderOutcomes().cancellationPercentage());
            case "fullName" -> Comparator.comparing(CustomerIntelligenceProfileDto::fullName, String.CASE_INSENSITIVE_ORDER);
            default -> Comparator.comparing(p -> p.purchaseMetrics().totalSpend());
        };
        return asc ? base : base.reversed();
    }

    private static <T> PagedResponse<T> paginateList(List<T> allItems, int page, int size) {
        int totalElements = allItems.size();
        int totalPages = totalElements == 0 ? 0 : (int) Math.ceil((double) totalElements / size);
        int fromIndex = page * size;
        List<T> slice = fromIndex >= totalElements
                ? Collections.emptyList()
                : allItems.subList(fromIndex, Math.min(fromIndex + size, totalElements));
        boolean hasNext = (page + 1) < totalPages;
        return new PagedResponse<>(slice, page, size, totalElements, totalPages, hasNext);
    }

    private record MerchantDataset(
            List<Customer> customers,
            List<Order> orders,
            List<OrderItem> orderItems,
            Map<UUID, List<Order>> ordersByCustomerId,
            Map<UUID, List<OrderItem>> itemsByCustomerId,
            List<CustomerIntelligenceProfileDto> profiles,
            BigDecimal highValueThreshold
    ) {
    }
}
