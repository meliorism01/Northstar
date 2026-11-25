package com.ordexa.customer.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "customers")
public class Customer {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "merchant_id", nullable = false, updatable = false)
    private UUID merchantId;

    @Column(name = "full_name", nullable = false, length = 160)
    private String fullName;

    @Column(name = "phone_number", nullable = false, length = 32)
    private String phoneNumber;

    @Column(name = "email", length = 255)
    private String email;

    @Column(name = "total_orders", nullable = false)
    private int totalOrders;

    @Column(name = "total_spent", nullable = false, precision = 14, scale = 2)
    private BigDecimal totalSpent;

    @Column(name = "first_order_at")
    private OffsetDateTime firstOrderAt;

    @Column(name = "last_order_at")
    private OffsetDateTime lastOrderAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected Customer() {
    }

    public Customer(
            UUID id,
            UUID merchantId,
            String fullName,
            String phoneNumber,
            String email) {
        this.id = id != null ? id : UUID.randomUUID();
        this.merchantId = merchantId;
        this.fullName = fullName;
        this.phoneNumber = phoneNumber;
        this.email = email;
        this.totalOrders = 0;
        this.totalSpent = BigDecimal.ZERO.setScale(2);
    }

    @PrePersist
    void onCreate() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        if (this.id == null) {
            this.id = UUID.randomUUID();
        }
        if (this.totalSpent == null) {
            this.totalSpent = BigDecimal.ZERO.setScale(2);
        }
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = OffsetDateTime.now(ZoneOffset.UTC);
    }

    public void recordNewOrder(BigDecimal orderTotal, OffsetDateTime orderTimestamp) {
        this.totalOrders += 1;
        this.totalSpent = this.totalSpent.add(orderTotal);
        if (this.firstOrderAt == null || orderTimestamp.isBefore(this.firstOrderAt)) {
            this.firstOrderAt = orderTimestamp;
        }
        if (this.lastOrderAt == null || orderTimestamp.isAfter(this.lastOrderAt)) {
            this.lastOrderAt = orderTimestamp;
        }
    }

    public void deductCancelledOrDeletedOrder(BigDecimal orderTotal) {
        if (this.totalOrders > 0) {
            this.totalOrders -= 1;
        }
        BigDecimal next = this.totalSpent.subtract(orderTotal);
        this.totalSpent = next.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO.setScale(2) : next;
    }

    public UUID getId() {
        return id;
    }

    public UUID getMerchantId() {
        return merchantId;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public int getTotalOrders() {
        return totalOrders;
    }

    public BigDecimal getTotalSpent() {
        return totalSpent;
    }

    public OffsetDateTime getFirstOrderAt() {
        return firstOrderAt;
    }

    public OffsetDateTime getLastOrderAt() {
        return lastOrderAt;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
