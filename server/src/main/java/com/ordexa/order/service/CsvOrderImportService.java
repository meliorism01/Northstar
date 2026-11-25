package com.ordexa.order.service;

import com.ordexa.common.exception.ErrorCode;
import com.ordexa.common.exception.OrdexaException;
import com.ordexa.customer.service.CustomerService;
import com.ordexa.order.dto.CreateOrderRequest;
import com.ordexa.order.dto.CsvImportSummaryDto;
import com.ordexa.order.dto.CsvRowErrorDto;
import com.ordexa.order.dto.OrderDetailDto;
import com.ordexa.order.dto.OrderItemRequest;
import com.ordexa.order.dto.OrderSummaryDto;
import com.ordexa.order.entity.OrderSource;
import com.ordexa.order.entity.PaymentMethod;
import com.ordexa.order.entity.PaymentStatus;
import com.ordexa.order.repository.OrderRepository;
import com.ordexa.tenant.context.TenantContext;
import com.ordexa.tenant.context.TenantContextHolder;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class CsvOrderImportService {

    private static final List<String> REQUIRED_HEADERS = List.of(
            "customername",
            "customerphone",
            "productname",
            "sku",
            "quantity",
            "unitprice",
            "paymentmethod",
            "shippingaddress"
    );

    private final OrderService orderService;
    private final OrderRepository orderRepository;

    public CsvOrderImportService(OrderService orderService, OrderRepository orderRepository) {
        this.orderService = orderService;
        this.orderRepository = orderRepository;
    }

    public CsvImportSummaryDto importCsvContent(String csvContent, String clientIp) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();

        if (csvContent == null || csvContent.isBlank()) {
            throw new OrdexaException(
                    "CSV payload must not be empty",
                    ErrorCode.CSV_IMPORT_INVALID,
                    HttpStatus.BAD_REQUEST);
        }

        String[] rawLines = csvContent.split("\\r?\\n");
        List<String> nonEmptyLines = new ArrayList<>();
        for (String line : rawLines) {
            if (line != null && !line.trim().isEmpty()) {
                nonEmptyLines.add(line.trim());
            }
        }

        if (nonEmptyLines.size() < 2) {
            throw new OrdexaException(
                    "CSV file must contain a header row and at least one data row",
                    ErrorCode.CSV_IMPORT_INVALID,
                    HttpStatus.BAD_REQUEST);
        }

        List<String> headers = parseCsvLine(nonEmptyLines.get(0))
                .stream()
                .map(h -> h.trim().toLowerCase(Locale.ROOT).replaceAll("[_\\s-]", ""))
                .toList();

        Map<String, Integer> headerIndex = new HashMap<>();
        for (int i = 0; i < headers.size(); i++) {
            headerIndex.put(headers.get(i), i);
        }

        List<String> missingHeaders = REQUIRED_HEADERS.stream()
                .filter(req -> !headerIndex.containsKey(req))
                .toList();

        if (!missingHeaders.isEmpty()) {
            throw new OrdexaException(
                    "Missing required CSV column header(s): " + String.join(", ", missingHeaders),
                    ErrorCode.CSV_IMPORT_INVALID,
                    HttpStatus.BAD_REQUEST);
        }

        List<OrderSummaryDto> importedOrders = new ArrayList<>();
        List<CsvRowErrorDto> errors = new ArrayList<>();
        Set<String> seenOrderNumbersInBatch = new HashSet<>();
        int totalRows = nonEmptyLines.size() - 1;

        for (int i = 1; i < nonEmptyLines.size(); i++) {
            int rowNumber = i + 1;
            List<String> cols = parseCsvLine(nonEmptyLines.get(i));
            String orderNumber = getColumn(cols, headerIndex, "ordernumber");

            try {
                if (orderNumber != null && !orderNumber.isBlank()) {
                    String normalizedOrderNum = orderNumber.trim().toUpperCase(Locale.ROOT);
                    if (!seenOrderNumbersInBatch.add(normalizedOrderNum)) {
                        throw new IllegalArgumentException(
                                "Duplicate orderNumber '" + normalizedOrderNum + "' within the same CSV batch");
                    }
                    if (orderRepository.existsByMerchantIdAndOrderNumberIgnoreCase(
                            ctx.merchantId(), normalizedOrderNum)) {
                        throw new IllegalArgumentException(
                                "Order number '" + normalizedOrderNum + "' already exists in this workspace");
                    }
                    orderNumber = normalizedOrderNum;
                }

                String customerName = requireColumn(cols, headerIndex, "customername", "customerName");
                String rawPhone = requireColumn(cols, headerIndex, "customerphone", "customerPhone");
                String normalizedPhone = CustomerService.normalizeAndValidatePhone(rawPhone);
                String customerEmail = getColumn(cols, headerIndex, "customeremail");

                String productName = requireColumn(cols, headerIndex, "productname", "productName");
                String sku = requireColumn(cols, headerIndex, "sku", "sku");
                int quantity = parsePositiveInt(requireColumn(cols, headerIndex, "quantity", "quantity"), "quantity");
                BigDecimal unitPrice = parseNonNegativeDecimal(
                        requireColumn(cols, headerIndex, "unitprice", "unitPrice"), "unitPrice");

                BigDecimal discount = parseOptionalDecimal(getColumn(cols, headerIndex, "discount"), "discount");
                BigDecimal shippingFee = parseOptionalDecimal(getColumn(cols, headerIndex, "shippingfee"), "shippingFee");

                PaymentMethod paymentMethod = parsePaymentMethod(
                        requireColumn(cols, headerIndex, "paymentmethod", "paymentMethod"));
                PaymentStatus paymentStatus = parseOptionalPaymentStatus(
                        getColumn(cols, headerIndex, "paymentstatus"));

                String shippingAddress = requireColumn(cols, headerIndex, "shippingaddress", "shippingAddress");
                if (shippingAddress.length() < 5) {
                    throw new IllegalArgumentException("shippingAddress must be at least 5 characters");
                }
                String customerNotes = getColumn(cols, headerIndex, "customernotes");

                CreateOrderRequest createReq = new CreateOrderRequest(
                        orderNumber,
                        OrderSource.CSV,
                        customerName,
                        normalizedPhone,
                        (customerEmail != null && !customerEmail.isBlank()) ? customerEmail : null,
                        paymentMethod,
                        paymentStatus,
                        discount,
                        shippingFee,
                        "INR",
                        shippingAddress,
                        shippingAddress,
                        customerNotes,
                        List.of(new OrderItemRequest(productName, sku, quantity, unitPrice))
                );

                OrderDetailDto created = orderService.createOrderForTenant(ctx, createReq, clientIp);
                importedOrders.add(created.order());
            } catch (Exception ex) {
                errors.add(new CsvRowErrorDto(
                        rowNumber,
                        (orderNumber != null && !orderNumber.isBlank()) ? orderNumber : "ROW-" + rowNumber,
                        ex.getMessage()));
            }
        }

        return new CsvImportSummaryDto(
                totalRows,
                importedOrders.size(),
                errors.size(),
                importedOrders,
                errors);
    }

    private static String getColumn(List<String> cols, Map<String, Integer> headerIndex, String key) {
        Integer idx = headerIndex.get(key);
        if (idx == null || idx < 0 || idx >= cols.size()) {
            return null;
        }
        String val = cols.get(idx).trim();
        return val.isEmpty() ? null : val;
    }

    private static String requireColumn(
            List<String> cols,
            Map<String, Integer> headerIndex,
            String key,
            String displayName) {
        String val = getColumn(cols, headerIndex, key);
        if (val == null || val.isBlank()) {
            throw new IllegalArgumentException("Missing required field '" + displayName + "'");
        }
        return val;
    }

    private static int parsePositiveInt(String raw, String fieldName) {
        try {
            int val = Integer.parseInt(raw.trim());
            if (val < 1) {
                throw new IllegalArgumentException(fieldName + " must be at least 1");
            }
            return val;
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("Invalid integer for " + fieldName + ": '" + raw + "'");
        }
    }

    private static BigDecimal parseNonNegativeDecimal(String raw, String fieldName) {
        try {
            BigDecimal val = new BigDecimal(raw.trim());
            if (val.compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException(fieldName + " must not be negative");
            }
            return val;
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("Invalid monetary amount for " + fieldName + ": '" + raw + "'");
        }
    }

    private static BigDecimal parseOptionalDecimal(String raw, String fieldName) {
        if (raw == null || raw.isBlank()) {
            return BigDecimal.ZERO;
        }
        return parseNonNegativeDecimal(raw, fieldName);
    }

    private static PaymentMethod parsePaymentMethod(String raw) {
        try {
            return PaymentMethod.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException(
                    "Invalid paymentMethod '" + raw + "'. Allowed: COD, PREPAID, UPI, CARD, NETBANKING");
        }
    }

    private static PaymentStatus parseOptionalPaymentStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return PaymentStatus.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException(
                    "Invalid paymentStatus '" + raw + "'. Allowed: PENDING, PAID, PARTIALLY_PAID, REFUNDED, FAILED");
        }
    }

    private static List<String> parseCsvLine(String line) {
        List<String> result = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;

        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (ch == '"') {
                inQuotes = !inQuotes;
            } else if (ch == ',' && !inQuotes) {
                result.add(current.toString().trim());
                current.setLength(0);
            } else {
                current.append(ch);
            }
        }
        result.add(current.toString().trim());
        return result;
    }
}
