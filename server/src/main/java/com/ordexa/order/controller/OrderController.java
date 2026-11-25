package com.ordexa.order.controller;

import com.ordexa.common.exception.ErrorCode;
import com.ordexa.common.exception.OrdexaException;
import com.ordexa.common.response.ApiResponse;
import com.ordexa.common.response.PagedResponse;
import com.ordexa.order.dto.CreateOrderRequest;
import com.ordexa.order.dto.CsvImportOrdersRequest;
import com.ordexa.order.dto.CsvImportSummaryDto;
import com.ordexa.order.dto.OrderDetailDto;
import com.ordexa.order.dto.OrderSummaryDto;
import com.ordexa.order.dto.UpdateOrderRequest;
import com.ordexa.order.dto.UpdateOrderStatusRequest;
import com.ordexa.order.entity.OrderStatus;
import com.ordexa.order.entity.PaymentStatus;
import com.ordexa.order.service.CsvOrderImportService;
import com.ordexa.order.service.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/orders")
@Tag(name = "Orders", description = "Merchant-scoped order lifecycle, search, filtering, and CSV batch import")
public class OrderController {

    private final OrderService orderService;
    private final CsvOrderImportService csvOrderImportService;
    private final Clock clock;

    public OrderController(
            OrderService orderService,
            CsvOrderImportService csvOrderImportService,
            Clock clock) {
        this.orderService = orderService;
        this.csvOrderImportService = csvOrderImportService;
        this.clock = clock;
    }

    @GetMapping
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "List merchant-scoped orders with search, filtering, sorting, and pagination")
    public ResponseEntity<ApiResponse<PagedResponse<OrderSummaryDto>>> listOrders(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) OrderStatus orderStatus,
            @RequestParam(required = false) PaymentStatus paymentStatus,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime toDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        PagedResponse<OrderSummaryDto> result = orderService.listOrders(
                search,
                orderStatus,
                paymentStatus,
                fromDate,
                toDate,
                page,
                size,
                sortBy,
                sortDir);
        return ResponseEntity.ok(ApiResponse.success("Orders retrieved", result, clock));
    }

    @GetMapping("/{id}")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "Get complete order details including line items, customer, and status history")
    public ResponseEntity<ApiResponse<OrderDetailDto>> getOrder(@PathVariable UUID id) {
        OrderDetailDto detail = orderService.getOrderById(id);
        return ResponseEntity.ok(ApiResponse.success("Order details retrieved", detail, clock));
    }

    @PostMapping
    @PreAuthorize("@tenantAuth.hasMinimumRole('OPERATOR')")
    @Operation(summary = "Create a new order with server-calculated totals and merchant-scoped customer resolution")
    public ResponseEntity<ApiResponse<OrderDetailDto>> createOrder(
            @Valid @RequestBody CreateOrderRequest request,
            HttpServletRequest servletRequest) {
        OrderDetailDto created = orderService.createOrder(request, servletRequest.getRemoteAddr());
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Order created successfully", created, clock));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("@tenantAuth.hasMinimumRole('OPERATOR')")
    @Operation(summary = "Update editable order metadata (shipping address, billing address, notes, payment status)")
    public ResponseEntity<ApiResponse<OrderDetailDto>> updateOrder(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateOrderRequest request,
            HttpServletRequest servletRequest) {
        OrderDetailDto updated = orderService.updateOrderDetails(id, request, servletRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success("Order updated successfully", updated, clock));
    }

    @PostMapping("/{id}/status")
    @PreAuthorize("@tenantAuth.hasMinimumRole('OPERATOR')")
    @Operation(summary = "Execute a validated order status transition and record status history")
    public ResponseEntity<ApiResponse<OrderDetailDto>> transitionStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateOrderStatusRequest request,
            HttpServletRequest servletRequest) {
        OrderDetailDto updated = orderService.transitionOrderStatus(id, request, servletRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success("Order status updated", updated, clock));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@tenantAuth.hasMinimumRole('MANAGER')")
    @Operation(summary = "Safely delete an order (allowed only when status is CREATED or CANCELLED)")
    public ResponseEntity<ApiResponse<Void>> deleteOrder(
            @PathVariable UUID id,
            HttpServletRequest servletRequest) {
        orderService.deleteOrder(id, servletRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success("Order deleted successfully", null, clock));
    }

    @PostMapping("/import-csv")
    @PreAuthorize("@tenantAuth.hasMinimumRole('OPERATOR')")
    @Operation(summary = "Import a batch of orders from CSV content with row-level validation and error reporting")
    public ResponseEntity<ApiResponse<CsvImportSummaryDto>> importCsv(
            @Valid @RequestBody CsvImportOrdersRequest request,
            HttpServletRequest servletRequest) {
        CsvImportSummaryDto summary =
                csvOrderImportService.importCsvContent(request.csvContent(), servletRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success("CSV import completed", summary, clock));
    }

    @PostMapping(value = "/import-csv/file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("@tenantAuth.hasMinimumRole('OPERATOR')")
    @Operation(summary = "Import a batch of orders from an uploaded .csv file")
    public ResponseEntity<ApiResponse<CsvImportSummaryDto>> importCsvFile(
            @RequestParam("file") MultipartFile file,
            HttpServletRequest servletRequest) {
        if (file == null || file.isEmpty()) {
            throw new OrdexaException(
                    "Uploaded CSV file must not be empty",
                    ErrorCode.CSV_IMPORT_INVALID,
                    HttpStatus.BAD_REQUEST);
        }
        try {
            String content = new String(file.getBytes(), StandardCharsets.UTF_8);
            CsvImportSummaryDto summary =
                    csvOrderImportService.importCsvContent(content, servletRequest.getRemoteAddr());
            return ResponseEntity.ok(ApiResponse.success("CSV file import completed", summary, clock));
        } catch (IOException ex) {
            throw new OrdexaException(
                    "Unable to read uploaded CSV file",
                    ErrorCode.CSV_IMPORT_INVALID,
                    HttpStatus.BAD_REQUEST);
        }
    }
}
