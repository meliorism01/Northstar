package com.ordexa.customer.service;

import com.ordexa.common.exception.ErrorCode;
import com.ordexa.common.exception.OrdexaException;
import com.ordexa.common.exception.ResourceNotFoundException;
import com.ordexa.common.response.PagedResponse;
import com.ordexa.common.validation.PaginationValidator;
import com.ordexa.customer.dto.CustomerSummaryDto;
import com.ordexa.customer.entity.Customer;
import com.ordexa.customer.repository.CustomerRepository;
import com.ordexa.tenant.context.TenantContext;
import com.ordexa.tenant.context.TenantContextHolder;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerService {

    private static final Pattern DIGITS_ONLY = Pattern.compile("^\\d{10,15}$");

    private final CustomerRepository customerRepository;

    public CustomerService(CustomerRepository customerRepository) {
        this.customerRepository = customerRepository;
    }

    public static String normalizeAndValidatePhone(String rawPhone) {
        if (rawPhone == null || rawPhone.isBlank()) {
            throw new OrdexaException(
                    "Customer phone number is required",
                    ErrorCode.VALIDATION_ERROR,
                    HttpStatus.BAD_REQUEST);
        }
        String digits = rawPhone.replaceAll("[\\s\\-().+]", "");
        if (digits.length() == 12 && digits.startsWith("91")) {
            digits = digits.substring(2);
        } else if (digits.length() == 11 && digits.startsWith("0")) {
            digits = digits.substring(1);
        }
        if (!DIGITS_ONLY.matcher(digits).matches()) {
            throw new OrdexaException(
                    "Invalid phone number format: must contain 10 to 15 digits",
                    ErrorCode.VALIDATION_ERROR,
                    HttpStatus.BAD_REQUEST);
        }
        return digits;
    }

    @Transactional
    public Customer resolveOrCreateCustomer(
            UUID merchantId,
            String fullName,
            String rawPhone,
            String rawEmail) {
        String normalizedPhone = normalizeAndValidatePhone(rawPhone);
        String cleanName = fullName != null ? fullName.trim() : "";
        if (cleanName.length() < 2) {
            throw new OrdexaException(
                    "Customer full name must be at least 2 characters",
                    ErrorCode.VALIDATION_ERROR,
                    HttpStatus.BAD_REQUEST);
        }
        String cleanEmail = (rawEmail != null && !rawEmail.isBlank())
                ? rawEmail.trim().toLowerCase(Locale.ROOT)
                : null;

        return customerRepository.findByMerchantIdAndPhoneNumber(merchantId, normalizedPhone)
                .map(existing -> {
                    existing.setFullName(cleanName);
                    if (cleanEmail != null) {
                        existing.setEmail(cleanEmail);
                    }
                    return customerRepository.save(existing);
                })
                .orElseGet(() -> {
                    Customer created = new Customer(
                            UUID.randomUUID(),
                            merchantId,
                            cleanName,
                            normalizedPhone,
                            cleanEmail);
                    return customerRepository.save(created);
                });
    }

    @Transactional(readOnly = true)
    public PagedResponse<CustomerSummaryDto> listCustomers(String search, int page, int size) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        PaginationValidator.validate(page, size);

        String searchPattern = (search != null && !search.isBlank())
                ? "%" + search.trim().toLowerCase(Locale.ROOT) + "%"
                : null;

        PageRequest pageRequest = PageRequest.of(
                page,
                size,
                Sort.by(Sort.Direction.DESC, "lastOrderAt", "createdAt"));

        Page<Customer> customerPage =
                customerRepository.searchByMerchant(ctx.merchantId(), searchPattern, pageRequest);

        return new PagedResponse<>(
                customerPage.getContent().stream().map(this::toSummaryDto).toList(),
                customerPage.getNumber(),
                customerPage.getSize(),
                customerPage.getTotalElements(),
                customerPage.getTotalPages(),
                customerPage.hasNext());
    }

    @Transactional(readOnly = true)
    public CustomerSummaryDto getCustomerById(UUID customerId) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        Customer customer = customerRepository.findByIdAndMerchantId(customerId, ctx.merchantId())
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found in active merchant workspace"));
        return toSummaryDto(customer);
    }

    public CustomerSummaryDto toSummaryDto(Customer c) {
        return new CustomerSummaryDto(
                c.getId(),
                c.getMerchantId(),
                c.getFullName(),
                c.getPhoneNumber(),
                c.getEmail(),
                c.getTotalOrders(),
                c.getTotalSpent(),
                c.getFirstOrderAt(),
                c.getLastOrderAt(),
                c.getCreatedAt(),
                c.getUpdatedAt());
    }
}
