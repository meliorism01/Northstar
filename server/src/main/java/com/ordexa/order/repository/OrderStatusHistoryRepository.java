package com.ordexa.order.repository;

import com.ordexa.order.entity.OrderStatusHistory;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OrderStatusHistoryRepository extends JpaRepository<OrderStatusHistory, UUID> {

    List<OrderStatusHistory> findByOrderIdAndMerchantIdOrderByCreatedAtAsc(UUID orderId, UUID merchantId);

    @org.springframework.data.jpa.repository.Query("""
            SELECT h FROM OrderStatusHistory h
            JOIN FETCH h.order o
            WHERE h.merchantId = :merchantId
              AND o.customer.id = :customerId
            ORDER BY h.createdAt DESC
            """)
    List<OrderStatusHistory> findByMerchantIdAndCustomerIdOrderByCreatedAtDesc(
            @org.springframework.data.repository.query.Param("merchantId") UUID merchantId,
            @org.springframework.data.repository.query.Param("customerId") UUID customerId);
}
