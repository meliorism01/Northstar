package com.ordexa.customer.intelligence.controller;

import com.ordexa.common.response.ApiResponse;
import com.ordexa.common.response.PagedResponse;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.Customer360Dto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.CustomerIntelligenceProfileDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.CustomerProductPreferenceDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.CustomerTimelineEventDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.GraphResponseDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.IntelligenceOverviewDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.ProductCoPurchaseDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.ProductDetailIntelligenceDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.ProductIntelligenceDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.SegmentAssignmentDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.SegmentSummaryDto;
import com.ordexa.customer.intelligence.service.CustomerIntelligenceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/intelligence")
@Tag(name = "Customer Intelligence Graph", description = "Merchant-scoped customer behavioural analytics, segmentation, Customer 360, product co-purchases, and relationship graph")
public class CustomerIntelligenceController {

    private final CustomerIntelligenceService intelligenceService;
    private final Clock clock;

    public CustomerIntelligenceController(
            CustomerIntelligenceService intelligenceService,
            Clock clock) {
        this.intelligenceService = intelligenceService;
        this.clock = clock;
    }

    @GetMapping("/overview")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "Get merchant-scoped customer intelligence overview KPIs and segment distribution")
    public ResponseEntity<ApiResponse<IntelligenceOverviewDto>> getOverview() {
        IntelligenceOverviewDto overview = intelligenceService.getOverview();
        return ResponseEntity.ok(ApiResponse.success("Customer intelligence overview retrieved", overview, clock));
    }

    @GetMapping("/graph")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "Generate the merchant-scoped Customer-Order-Product-Segment intelligence graph")
    public ResponseEntity<ApiResponse<GraphResponseDto>> getGraph(
            @RequestParam(required = false) String nodeType,
            @RequestParam(required = false) UUID customerId,
            @RequestParam(required = false) String productSku,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime toDate,
            @RequestParam(defaultValue = "120") int limit) {
        GraphResponseDto graph = intelligenceService.getGraph(
                nodeType, customerId, productSku, segment, fromDate, toDate, limit);
        return ResponseEntity.ok(ApiResponse.success("Customer intelligence graph generated", graph, clock));
    }

    @GetMapping("/customers")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "List merchant-scoped customer intelligence profiles with segment, order-count, spend, and recency filtering")
    public ResponseEntity<ApiResponse<PagedResponse<CustomerIntelligenceProfileDto>>> listIntelligentCustomers(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String segment,
            @RequestParam(required = false) Integer minOrders,
            @RequestParam(required = false) Integer maxOrders,
            @RequestParam(required = false) BigDecimal minSpend,
            @RequestParam(required = false) Long maxDaysSinceLastOrder,
            @RequestParam(defaultValue = "totalSpend") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PagedResponse<CustomerIntelligenceProfileDto> result = intelligenceService.listIntelligentCustomers(
                search, segment, minOrders, maxOrders, minSpend, maxDaysSinceLastOrder, sortBy, sortDir, page, size);
        return ResponseEntity.ok(ApiResponse.success("Customer intelligence directory retrieved", result, clock));
    }

    @GetMapping("/customers/{customerId}")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "Get complete Customer 360 intelligence profile, segments, product preferences, timeline, and subgraph")
    public ResponseEntity<ApiResponse<Customer360Dto>> getCustomer360(@PathVariable UUID customerId) {
        Customer360Dto dto = intelligenceService.getCustomer360(customerId);
        return ResponseEntity.ok(ApiResponse.success("Customer 360 intelligence profile retrieved", dto, clock));
    }

    @GetMapping("/customers/{customerId}/graph")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "Get the dedicated individual relationship graph for a single selected customer")
    public ResponseEntity<ApiResponse<GraphResponseDto>> getCustomerGraph(@PathVariable UUID customerId) {
        GraphResponseDto graph = intelligenceService.getCustomerGraph(customerId);
        return ResponseEntity.ok(ApiResponse.success("Individual customer intelligence graph generated", graph, clock));
    }

    @GetMapping("/customers/{customerId}/segments")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "Get explainable behavioural segment assignments for a customer")
    public ResponseEntity<ApiResponse<List<SegmentAssignmentDto>>> getCustomerSegments(@PathVariable UUID customerId) {
        List<SegmentAssignmentDto> segments = intelligenceService.getCustomerSegments(customerId);
        return ResponseEntity.ok(ApiResponse.success("Customer behavioural segments retrieved", segments, clock));
    }

    @GetMapping("/customers/{customerId}/timeline")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "Get chronological purchase and behavioural event timeline for a customer")
    public ResponseEntity<ApiResponse<List<CustomerTimelineEventDto>>> getCustomerTimeline(@PathVariable UUID customerId) {
        List<CustomerTimelineEventDto> timeline = intelligenceService.getCustomerTimeline(customerId);
        return ResponseEntity.ok(ApiResponse.success("Customer purchase timeline retrieved", timeline, clock));
    }

    @GetMapping("/customers/{customerId}/products")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "Get product preferences and repeat SKU breakdown for a customer")
    public ResponseEntity<ApiResponse<List<CustomerProductPreferenceDto>>> getCustomerProducts(@PathVariable UUID customerId) {
        List<CustomerProductPreferenceDto> products = intelligenceService.getCustomerProducts(customerId);
        return ResponseEntity.ok(ApiResponse.success("Customer product preferences retrieved", products, clock));
    }

    @GetMapping("/segments")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "List all deterministic behavioural segments, threshold rules, and customer counts")
    public ResponseEntity<ApiResponse<List<SegmentSummaryDto>>> listSegments() {
        List<SegmentSummaryDto> segments = intelligenceService.listSegments();
        return ResponseEntity.ok(ApiResponse.success("Behavioural segments retrieved", segments, clock));
    }

    @GetMapping("/segments/{segmentId}")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "Get summary metrics and rule definition for a specific segment")
    public ResponseEntity<ApiResponse<SegmentSummaryDto>> getSegmentDetail(@PathVariable String segmentId) {
        SegmentSummaryDto segment = intelligenceService.getSegmentDetail(segmentId);
        return ResponseEntity.ok(ApiResponse.success("Segment summary retrieved", segment, clock));
    }

    @GetMapping("/segments/{segmentId}/customers")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "List paginated customers assigned to a specific behavioural segment")
    public ResponseEntity<ApiResponse<PagedResponse<CustomerIntelligenceProfileDto>>> listSegmentCustomers(
            @PathVariable String segmentId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PagedResponse<CustomerIntelligenceProfileDto> result =
                intelligenceService.listSegmentCustomers(segmentId, page, size);
        return ResponseEntity.ok(ApiResponse.success("Segment customers retrieved", result, clock));
    }

    @GetMapping("/products")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "List merchant-scoped product intelligence metrics (units sold, revenue, unique & repeat customers)")
    public ResponseEntity<ApiResponse<PagedResponse<ProductIntelligenceDto>>> listProducts(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "totalRevenue") String sortBy,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PagedResponse<ProductIntelligenceDto> result = intelligenceService.listProducts(search, sortBy, page, size);
        return ResponseEntity.ok(ApiResponse.success("Product intelligence retrieved", result, clock));
    }

    @GetMapping("/products/co-purchases")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "Compute explainable product co-purchase pairs across orders and shared customers")
    public ResponseEntity<ApiResponse<List<ProductCoPurchaseDto>>> listProductCoPurchases(
            @RequestParam(defaultValue = "1") int minCoPurchases,
            @RequestParam(defaultValue = "20") int limit) {
        List<ProductCoPurchaseDto> pairs = intelligenceService.listProductCoPurchases(minCoPurchases, limit);
        return ResponseEntity.ok(ApiResponse.success("Product co-purchase combinations retrieved", pairs, clock));
    }

    @GetMapping("/products/{sku}")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "Get product intelligence detail, customer buyers, and co-purchased products for a specific SKU")
    public ResponseEntity<ApiResponse<ProductDetailIntelligenceDto>> getProductDetail(@PathVariable String sku) {
        ProductDetailIntelligenceDto detail = intelligenceService.getProductDetail(sku);
        return ResponseEntity.ok(ApiResponse.success("Product SKU intelligence retrieved", detail, clock));
    }
}
