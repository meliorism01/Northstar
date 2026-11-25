package com.ordexa.customer.controller;

import com.ordexa.common.response.ApiResponse;
import com.ordexa.common.response.PagedResponse;
import com.ordexa.customer.dto.CustomerDetailDto;
import com.ordexa.customer.dto.CustomerSummaryDto;
import com.ordexa.customer.service.CustomerService;
import com.ordexa.order.service.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Clock;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/customers")
@Tag(name = "Customers", description = "Merchant-scoped customer profiles and order history")
public class CustomerController {

    private final CustomerService customerService;
    private final OrderService orderService;
    private final Clock clock;

    public CustomerController(
            CustomerService customerService,
            OrderService orderService,
            Clock clock) {
        this.customerService = customerService;
        this.orderService = orderService;
        this.clock = clock;
    }

    @GetMapping
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "List merchant-scoped customers with search and pagination")
    public ResponseEntity<ApiResponse<PagedResponse<CustomerSummaryDto>>> listCustomers(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PagedResponse<CustomerSummaryDto> result = customerService.listCustomers(search, page, size);
        return ResponseEntity.ok(ApiResponse.success("Customers retrieved", result, clock));
    }

    @GetMapping("/{id}")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "Get a merchant-scoped customer by ID")
    public ResponseEntity<ApiResponse<CustomerSummaryDto>> getCustomer(@PathVariable UUID id) {
        CustomerSummaryDto customer = customerService.getCustomerById(id);
        return ResponseEntity.ok(ApiResponse.success("Customer retrieved", customer, clock));
    }

    @GetMapping("/{id}/orders")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "Get a merchant-scoped customer and their complete order history")
    public ResponseEntity<ApiResponse<CustomerDetailDto>> getCustomerOrders(@PathVariable UUID id) {
        CustomerDetailDto detail = orderService.getCustomerWithOrders(id);
        return ResponseEntity.ok(ApiResponse.success("Customer order history retrieved", detail, clock));
    }
}
