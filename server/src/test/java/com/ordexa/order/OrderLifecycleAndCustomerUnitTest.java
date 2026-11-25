package com.ordexa.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.ordexa.common.exception.ErrorCode;
import com.ordexa.common.exception.OrdexaException;
import com.ordexa.customer.entity.Customer;
import com.ordexa.customer.service.CustomerService;
import com.ordexa.order.entity.OrderStatus;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class OrderLifecycleAndCustomerUnitTest {

    @Test
    void orderStatusLifecycleAllowsValidForwardAndCancelTransitionsAndBlocksInvalidOnes() {
        assertThat(OrderStatus.CREATED.canTransitionTo(OrderStatus.CONFIRMED)).isTrue();
        assertThat(OrderStatus.CREATED.canTransitionTo(OrderStatus.CANCELLED)).isTrue();
        assertThat(OrderStatus.CREATED.canTransitionTo(OrderStatus.DELIVERED)).isFalse();
        assertThat(OrderStatus.CREATED.canTransitionTo(OrderStatus.SHIPPED)).isFalse();

        assertThat(OrderStatus.CONFIRMED.canTransitionTo(OrderStatus.PROCESSING)).isTrue();
        assertThat(OrderStatus.CONFIRMED.canTransitionTo(OrderStatus.CANCELLED)).isTrue();
        assertThat(OrderStatus.CONFIRMED.canTransitionTo(OrderStatus.DELIVERED)).isFalse();

        assertThat(OrderStatus.PROCESSING.canTransitionTo(OrderStatus.SHIPPED)).isTrue();
        assertThat(OrderStatus.PROCESSING.canTransitionTo(OrderStatus.CANCELLED)).isTrue();

        assertThat(OrderStatus.SHIPPED.canTransitionTo(OrderStatus.DELIVERED)).isTrue();
        assertThat(OrderStatus.SHIPPED.canTransitionTo(OrderStatus.CANCELLED)).isFalse();

        assertThat(OrderStatus.DELIVERED.allowedNextStatuses()).isEmpty();
        assertThat(OrderStatus.CANCELLED.allowedNextStatuses()).isEmpty();
    }

    @Test
    void orderDeletionPolicyOnlyPermitsCreatedOrCancelledOrders() {
        assertThat(OrderStatus.CREATED.isDeletable()).isTrue();
        assertThat(OrderStatus.CANCELLED.isDeletable()).isTrue();

        assertThat(OrderStatus.CONFIRMED.isDeletable()).isFalse();
        assertThat(OrderStatus.PROCESSING.isDeletable()).isFalse();
        assertThat(OrderStatus.SHIPPED.isDeletable()).isFalse();
        assertThat(OrderStatus.DELIVERED.isDeletable()).isFalse();
    }

    @Test
    void phoneNormalizationHandlesIndianPrefixesAndRejectsMalformedNumbers() {
        assertThat(CustomerService.normalizeAndValidatePhone("+91 98114-56723")).isEqualTo("9811456723");
        assertThat(CustomerService.normalizeAndValidatePhone("09811456723")).isEqualTo("9811456723");
        assertThat(CustomerService.normalizeAndValidatePhone("9811456723")).isEqualTo("9811456723");

        assertThatThrownBy(() -> CustomerService.normalizeAndValidatePhone("12345"))
                .isInstanceOf(OrdexaException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.VALIDATION_ERROR);

        assertThatThrownBy(() -> CustomerService.normalizeAndValidatePhone("abc-phone"))
                .isInstanceOf(OrdexaException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.VALIDATION_ERROR);
    }

    @Test
    void customerEntityAccuratelyAccumulatesAndDeductsBigDecimalOrderTotals() {
        Customer customer = new Customer(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "Rahul Sharma",
                "9811456723",
                "rahul@example.in");

        OffsetDateTime t1 = OffsetDateTime.of(2026, 11, 20, 10, 0, 0, 0, ZoneOffset.UTC);
        OffsetDateTime t2 = OffsetDateTime.of(2026, 11, 25, 12, 0, 0, 0, ZoneOffset.UTC);

        customer.recordNewOrder(new BigDecimal("1499.50"), t1);
        customer.recordNewOrder(new BigDecimal("2000.25"), t2);

        assertThat(customer.getTotalOrders()).isEqualTo(2);
        assertThat(customer.getTotalSpent()).isEqualByComparingTo("3499.75");
        assertThat(customer.getFirstOrderAt()).isEqualTo(t1);
        assertThat(customer.getLastOrderAt()).isEqualTo(t2);

        customer.deductCancelledOrDeletedOrder(new BigDecimal("1499.50"));
        assertThat(customer.getTotalOrders()).isEqualTo(1);
        assertThat(customer.getTotalSpent()).isEqualByComparingTo("2000.25");
    }
}
