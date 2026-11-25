package com.ordexa.order.service;

import com.ordexa.auth.entity.AuditLog;
import com.ordexa.auth.token.AuditLogRepository;
import com.ordexa.common.exception.ErrorCode;
import com.ordexa.common.exception.OrdexaException;
import com.ordexa.common.exception.ResourceNotFoundException;
import com.ordexa.common.response.PagedResponse;
import com.ordexa.common.validation.PaginationValidator;
import com.ordexa.customer.dto.CustomerDetailDto;
import com.ordexa.customer.dto.CustomerSummaryDto;
import com.ordexa.customer.entity.Customer;
import com.ordexa.customer.repository.CustomerRepository;
import com.ordexa.customer.service.CustomerService;
import com.ordexa.order.dto.CreateOrderRequest;
import com.ordexa.order.dto.OrderDetailDto;
import com.ordexa.order.dto.OrderItemDto;
import com.ordexa.order.dto.OrderItemRequest;
import com.ordexa.order.dto.OrderStatusHistoryDto;
import com.ordexa.order.dto.OrderSummaryDto;
import com.ordexa.order.dto.UpdateOrderRequest;
import com.ordexa.order.dto.UpdateOrderStatusRequest;
import com.ordexa.order.entity.Order;
import com.ordexa.order.entity.OrderItem;
import com.ordexa.order.entity.OrderSource;
import com.ordexa.order.entity.OrderStatus;
import com.ordexa.order.entity.OrderStatusHistory;
import com.ordexa.order.entity.PaymentMethod;
import com.ordexa.order.entity.PaymentStatus;
import com.ordexa.order.repository.OrderItemRepository;
import com.ordexa.order.repository.OrderRepository;
import com.ordexa.order.repository.OrderStatusHistoryRepository;
import com.ordexa.tenant.context.TenantContext;
import com.ordexa.tenant.context.TenantContextHolder;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderService {

    private static final Set<String> ALLOWED_SORT_FIELDS =
            Set.of("createdAt", "totalAmount", "orderNumber", "orderStatus");

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final OrderStatusHistoryRepository statusHistoryRepository;
    private final CustomerRepository customerRepository;
    private final CustomerService customerService;
    private final AuditLogRepository auditLogRepository;
    private final Clock clock;

    public OrderService(
            OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            OrderStatusHistoryRepository statusHistoryRepository,
            CustomerRepository customerRepository,
            CustomerService customerService,
            AuditLogRepository auditLogRepository,
            Clock clock) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.statusHistoryRepository = statusHistoryRepository;
        this.customerRepository = customerRepository;
        this.customerService = customerService;
        this.auditLogRepository = auditLogRepository;
        this.clock = clock;
    }

    @Transactional
    public OrderDetailDto createOrder(CreateOrderRequest request, String clientIp) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        return createOrderForTenant(ctx, request, clientIp);
    }

    @Transactional
    public OrderDetailDto createOrderForTenant(
            TenantContext ctx,
            CreateOrderRequest request,
            String clientIp) {
        UUID merchantId = ctx.merchantId();
        String orderNumber = resolveUniqueOrderNumber(merchantId, request.orderNumber());

        if (request.items() == null || request.items().isEmpty()) {
            throw new OrdexaException(
                    "Order must contain at least one line item",
                    ErrorCode.VALIDATION_ERROR,
                    HttpStatus.BAD_REQUEST);
        }

        BigDecimal subtotal = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        for (OrderItemRequest itemReq : request.items()) {
            if (itemReq.quantity() == null || itemReq.quantity() < 1) {
                throw new OrdexaException(
                        "Item quantity must be at least 1",
                        ErrorCode.VALIDATION_ERROR,
                        HttpStatus.BAD_REQUEST);
            }
            if (itemReq.unitPrice() == null || itemReq.unitPrice().compareTo(BigDecimal.ZERO) < 0) {
                throw new OrdexaException(
                        "Item unit price must not be negative",
                        ErrorCode.VALIDATION_ERROR,
                        HttpStatus.BAD_REQUEST);
            }
            BigDecimal lineTotal = itemReq.unitPrice()
                    .setScale(2, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(itemReq.quantity()));
            subtotal = subtotal.add(lineTotal);
        }

        BigDecimal discount = request.discount() != null
                ? request.discount().setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        if (discount.compareTo(BigDecimal.ZERO) < 0 || discount.compareTo(subtotal) > 0) {
            throw new OrdexaException(
                    "Order discount must be between 0.00 and the order subtotal (" + subtotal + ")",
                    ErrorCode.VALIDATION_ERROR,
                    HttpStatus.BAD_REQUEST);
        }

        BigDecimal shippingFee = request.shippingFee() != null
                ? request.shippingFee().setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        if (shippingFee.compareTo(BigDecimal.ZERO) < 0) {
            throw new OrdexaException(
                    "Shipping fee must not be negative",
                    ErrorCode.VALIDATION_ERROR,
                    HttpStatus.BAD_REQUEST);
        }

        BigDecimal totalAmount = subtotal.subtract(discount).add(shippingFee).setScale(2, RoundingMode.HALF_UP);

        Customer customer = customerService.resolveOrCreateCustomer(
                merchantId,
                request.customerName(),
                request.customerPhone(),
                request.customerEmail());

        OffsetDateTime now = OffsetDateTime.now(clock);
        customer.recordNewOrder(totalAmount, now);
        customerRepository.save(customer);

        OrderSource source = request.source() != null ? request.source() : OrderSource.MANUAL;
        PaymentMethod paymentMethod = request.paymentMethod();
        PaymentStatus paymentStatus = request.paymentStatus() != null
                ? request.paymentStatus()
                : (paymentMethod == PaymentMethod.COD ? PaymentStatus.PENDING : PaymentStatus.PAID);

        String cleanShipping = request.shippingAddress().trim();
        String cleanBilling = (request.billingAddress() != null && !request.billingAddress().isBlank())
                ? request.billingAddress().trim()
                : cleanShipping;
        String cleanNotes = (request.customerNotes() != null && !request.customerNotes().isBlank())
                ? request.customerNotes().trim()
                : null;

        Order order = new Order(
                UUID.randomUUID(),
                merchantId,
                orderNumber,
                customer,
                source,
                OrderStatus.CREATED,
                paymentStatus,
                paymentMethod,
                subtotal,
                discount,
                shippingFee,
                totalAmount,
                request.currency(),
                cleanShipping,
                cleanBilling,
                cleanNotes);

        for (OrderItemRequest itemReq : request.items()) {
            BigDecimal unitPrice = itemReq.unitPrice().setScale(2, RoundingMode.HALF_UP);
            BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(itemReq.quantity()));
            OrderItem item = new OrderItem(
                    UUID.randomUUID(),
                    merchantId,
                    order,
                    itemReq.productName().trim(),
                    itemReq.sku().trim().toUpperCase(Locale.ROOT),
                    itemReq.quantity(),
                    unitPrice,
                    lineTotal);
            order.addItem(item);
        }

        OrderStatusHistory initialHistory = new OrderStatusHistory(
                UUID.randomUUID(),
                merchantId,
                order,
                null,
                OrderStatus.CREATED,
                ctx.fullName(),
                "Order created via " + source.name());
        order.addStatusHistory(initialHistory);

        Order saved = orderRepository.save(order);

        auditLogRepository.save(new AuditLog(
                merchantId,
                ctx.userId(),
                "ORDER_CREATED",
                "ORDER",
                saved.getId().toString(),
                "Created order " + saved.getOrderNumber() + " (" + totalAmount + " " + saved.getCurrency() + ")",
                clientIp));

        return toDetailDto(saved, saved.getItems(), saved.getStatusHistory());
    }

    @Transactional(readOnly = true)
    public PagedResponse<OrderSummaryDto> listOrders(
            String search,
            OrderStatus orderStatus,
            PaymentStatus paymentStatus,
            OffsetDateTime fromDate,
            OffsetDateTime toDate,
            int page,
            int size,
            String sortBy,
            String sortDir) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        PaginationValidator.validate(page, size);

        String resolvedSortField = (sortBy != null && ALLOWED_SORT_FIELDS.contains(sortBy))
                ? sortBy
                : "createdAt";
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDir)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;

        Specification<Order> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("merchantId"), ctx.merchantId()));

            if (orderStatus != null) {
                predicates.add(cb.equal(root.get("orderStatus"), orderStatus));
            }
            if (paymentStatus != null) {
                predicates.add(cb.equal(root.get("paymentStatus"), paymentStatus));
            }
            if (fromDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), fromDate));
            }
            if (toDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), toDate));
            }
            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
                Join<Order, Customer> customerJoin = root.join("customer");
                Predicate byOrderNumber = cb.like(cb.lower(root.get("orderNumber")), pattern);
                Predicate byCustomerName = cb.like(cb.lower(customerJoin.get("fullName")), pattern);
                Predicate byCustomerPhone = cb.like(cb.lower(customerJoin.get("phoneNumber")), pattern);
                predicates.add(cb.or(byOrderNumber, byCustomerName, byCustomerPhone));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<Order> orderPage = orderRepository.findAll(
                spec,
                PageRequest.of(page, size, Sort.by(direction, resolvedSortField)));

        List<Order> orders = orderPage.getContent();
        Map<UUID, List<OrderItem>> itemsByOrderId = loadItemsBatch(ctx.merchantId(), orders);

        List<OrderSummaryDto> summaries = orders.stream()
                .map(o -> toSummaryDto(o, itemsByOrderId.getOrDefault(o.getId(), Collections.emptyList())))
                .toList();

        return new PagedResponse<>(
                summaries,
                orderPage.getNumber(),
                orderPage.getSize(),
                orderPage.getTotalElements(),
                orderPage.getTotalPages(),
                orderPage.hasNext());
    }

    @Transactional(readOnly = true)
    public OrderDetailDto getOrderById(UUID orderId) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        Order order = orderRepository.findByIdAndMerchantIdWithCustomer(orderId, ctx.merchantId())
                .orElseThrow(() -> new ResourceNotFoundException("Order not found in active merchant workspace"));

        List<OrderItem> items = orderItemRepository.findByOrderIdAndMerchantId(order.getId(), ctx.merchantId());
        List<OrderStatusHistory> history =
                statusHistoryRepository.findByOrderIdAndMerchantIdOrderByCreatedAtAsc(order.getId(), ctx.merchantId());

        return toDetailDto(order, items, history);
    }

    @Transactional
    public OrderDetailDto updateOrderDetails(
            UUID orderId,
            UpdateOrderRequest request,
            String clientIp) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        Order order = orderRepository.findByIdAndMerchantIdWithCustomer(orderId, ctx.merchantId())
                .orElseThrow(() -> new ResourceNotFoundException("Order not found in active merchant workspace"));

        if (request.shippingAddress() != null && !request.shippingAddress().isBlank()) {
            order.setShippingAddress(request.shippingAddress().trim());
        }
        if (request.billingAddress() != null) {
            order.setBillingAddress(request.billingAddress().trim());
        }
        if (request.customerNotes() != null) {
            order.setCustomerNotes(request.customerNotes().trim());
        }
        if (request.paymentStatus() != null) {
            order.setPaymentStatus(request.paymentStatus());
        }

        Order saved = orderRepository.save(order);
        auditLogRepository.save(new AuditLog(
                ctx.merchantId(),
                ctx.userId(),
                "ORDER_UPDATED",
                "ORDER",
                saved.getId().toString(),
                "Updated metadata on order " + saved.getOrderNumber(),
                clientIp));

        List<OrderItem> items = orderItemRepository.findByOrderIdAndMerchantId(saved.getId(), ctx.merchantId());
        List<OrderStatusHistory> history =
                statusHistoryRepository.findByOrderIdAndMerchantIdOrderByCreatedAtAsc(saved.getId(), ctx.merchantId());
        return toDetailDto(saved, items, history);
    }

    @Transactional
    public OrderDetailDto transitionOrderStatus(
            UUID orderId,
            UpdateOrderStatusRequest request,
            String clientIp) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        Order order = orderRepository.findByIdAndMerchantIdWithCustomer(orderId, ctx.merchantId())
                .orElseThrow(() -> new ResourceNotFoundException("Order not found in active merchant workspace"));

        OrderStatus currentStatus = order.getOrderStatus();
        OrderStatus targetStatus = request.newStatus();

        if (!currentStatus.canTransitionTo(targetStatus)) {
            throw new OrdexaException(
                    "Invalid order status transition from " + currentStatus + " to " + targetStatus
                            + ". Allowed transitions: " + currentStatus.allowedNextStatuses(),
                    ErrorCode.INVALID_STATUS_TRANSITION,
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        order.setOrderStatus(targetStatus);
        if (targetStatus == OrderStatus.DELIVERED && order.getPaymentStatus() == PaymentStatus.PENDING) {
            order.setPaymentStatus(PaymentStatus.PAID);
        }
        if (targetStatus == OrderStatus.CANCELLED) {
            Customer customer = order.getCustomer();
            customer.deductCancelledOrDeletedOrder(order.getTotalAmount());
            customerRepository.save(customer);
        }

        String reason = (request.reason() != null && !request.reason().isBlank())
                ? request.reason().trim()
                : "Status transitioned from " + currentStatus + " to " + targetStatus;

        OrderStatusHistory historyEntry = new OrderStatusHistory(
                UUID.randomUUID(),
                ctx.merchantId(),
                order,
                currentStatus,
                targetStatus,
                ctx.fullName(),
                reason);
        statusHistoryRepository.save(historyEntry);
        orderRepository.save(order);

        auditLogRepository.save(new AuditLog(
                ctx.merchantId(),
                ctx.userId(),
                "ORDER_STATUS_CHANGED",
                "ORDER",
                order.getId().toString(),
                order.getOrderNumber() + ": " + currentStatus + " -> " + targetStatus + " (" + reason + ")",
                clientIp));

        List<OrderItem> items = orderItemRepository.findByOrderIdAndMerchantId(order.getId(), ctx.merchantId());
        List<OrderStatusHistory> history =
                statusHistoryRepository.findByOrderIdAndMerchantIdOrderByCreatedAtAsc(order.getId(), ctx.merchantId());
        return toDetailDto(order, items, history);
    }

    @Transactional
    public void deleteOrder(UUID orderId, String clientIp) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        Order order = orderRepository.findByIdAndMerchantIdWithCustomer(orderId, ctx.merchantId())
                .orElseThrow(() -> new ResourceNotFoundException("Order not found in active merchant workspace"));

        if (!order.getOrderStatus().isDeletable()) {
            throw new OrdexaException(
                    "Only orders in CREATED or CANCELLED status can be deleted (current status: "
                            + order.getOrderStatus() + ")",
                    ErrorCode.ORDER_DELETION_NOT_ALLOWED,
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        if (order.getOrderStatus() != OrderStatus.CANCELLED) {
            Customer customer = order.getCustomer();
            customer.deductCancelledOrDeletedOrder(order.getTotalAmount());
            customerRepository.save(customer);
        }

        String orderNumber = order.getOrderNumber();
        orderRepository.delete(order);

        auditLogRepository.save(new AuditLog(
                ctx.merchantId(),
                ctx.userId(),
                "ORDER_DELETED",
                "ORDER",
                orderId.toString(),
                "Deleted order " + orderNumber,
                clientIp));
    }

    @Transactional(readOnly = true)
    public CustomerDetailDto getCustomerWithOrders(UUID customerId) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        Customer customer = customerRepository.findByIdAndMerchantId(customerId, ctx.merchantId())
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found in active merchant workspace"));

        List<Order> customerOrders = orderRepository
                .findByMerchantIdAndCustomerIdOrderByCreatedAtDesc(ctx.merchantId(), customerId);
        Map<UUID, List<OrderItem>> itemsByOrder = loadItemsBatch(ctx.merchantId(), customerOrders);

        List<OrderSummaryDto> orderDtos = customerOrders.stream()
                .map(o -> toSummaryDto(o, itemsByOrder.getOrDefault(o.getId(), Collections.emptyList())))
                .toList();

        return new CustomerDetailDto(customerService.toSummaryDto(customer), orderDtos);
    }

    private Map<UUID, List<OrderItem>> loadItemsBatch(UUID merchantId, List<Order> orders) {
        if (orders.isEmpty()) {
            return Collections.emptyMap();
        }
        List<UUID> ids = orders.stream().map(Order::getId).toList();
        return orderItemRepository.findByOrderIdInAndMerchantId(ids, merchantId)
                .stream()
                .collect(Collectors.groupingBy(item -> item.getOrder().getId()));
    }

    private String resolveUniqueOrderNumber(UUID merchantId, String requestedNumber) {
        if (requestedNumber != null && !requestedNumber.isBlank()) {
            String normalized = requestedNumber.trim().toUpperCase(Locale.ROOT);
            if (orderRepository.existsByMerchantIdAndOrderNumberIgnoreCase(merchantId, normalized)) {
                throw new OrdexaException(
                        "Order number '" + normalized + "' already exists in this merchant workspace",
                        ErrorCode.DUPLICATE_ORDER_NUMBER,
                        HttpStatus.CONFLICT);
            }
            return normalized;
        }

        String generated;
        do {
            int rand = ThreadLocalRandom.current().nextInt(10000, 99999);
            generated = "ORD-" + rand;
        } while (orderRepository.existsByMerchantIdAndOrderNumberIgnoreCase(merchantId, generated));
        return generated;
    }

    public OrderSummaryDto toSummaryDto(Order order, List<OrderItem> items) {
        Customer c = order.getCustomer();
        List<OrderItemDto> itemDtos = items.stream()
                .map(this::toItemDto)
                .toList();
        int totalUnitCount = items.stream().mapToInt(OrderItem::getQuantity).sum();
        String primaryProduct = items.isEmpty()
                ? "Order Item"
                : items.get(0).getProductName() + (items.size() > 1 ? " (+" + (items.size() - 1) + " more)" : "");

        return new OrderSummaryDto(
                order.getId(),
                order.getMerchantId(),
                order.getOrderNumber(),
                c.getId(),
                c.getFullName(),
                c.getPhoneNumber(),
                c.getEmail(),
                order.getSource(),
                order.getOrderStatus(),
                order.getPaymentStatus(),
                order.getPaymentMethod(),
                order.getSubtotal(),
                order.getDiscount(),
                order.getShippingFee(),
                order.getTotalAmount(),
                order.getCurrency(),
                order.getShippingAddress(),
                order.getBillingAddress(),
                order.getCustomerNotes(),
                totalUnitCount,
                primaryProduct,
                order.getOrderStatus().allowedNextStatuses(),
                order.getCreatedAt(),
                order.getUpdatedAt(),
                itemDtos);
    }

    public OrderDetailDto toDetailDto(
            Order order,
            List<OrderItem> items,
            List<OrderStatusHistory> history) {
        OrderSummaryDto summary = toSummaryDto(order, items);
        CustomerSummaryDto customerDto = customerService.toSummaryDto(order.getCustomer());
        List<OrderItemDto> itemDtos = items.stream().map(this::toItemDto).toList();
        List<OrderStatusHistoryDto> historyDtos = history.stream()
                .map(h -> new OrderStatusHistoryDto(
                        h.getId(),
                        h.getPreviousStatus(),
                        h.getNewStatus(),
                        h.getChangedBy(),
                        h.getReason(),
                        h.getCreatedAt()))
                .toList();
        return new OrderDetailDto(summary, customerDto, itemDtos, historyDtos);
    }

    private OrderItemDto toItemDto(OrderItem item) {
        return new OrderItemDto(
                item.getId(),
                item.getProductName(),
                item.getSku(),
                item.getQuantity(),
                item.getUnitPrice(),
                item.getTotalPrice());
    }
}
