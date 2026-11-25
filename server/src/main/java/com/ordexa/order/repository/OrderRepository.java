package com.ordexa.order.repository;

import com.ordexa.order.entity.Order;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface OrderRepository extends JpaRepository<Order, UUID>, JpaSpecificationExecutor<Order> {

    @Override
    @EntityGraph(attributePaths = {"customer"})
    Page<Order> findAll(Specification<Order> spec, Pageable pageable);

    @Query("""
            SELECT o FROM Order o
            JOIN FETCH o.customer c
            WHERE o.id = :orderId
              AND o.merchantId = :merchantId
            """)
    Optional<Order> findByIdAndMerchantIdWithCustomer(
            @Param("orderId") UUID orderId,
            @Param("merchantId") UUID merchantId);

    boolean existsByMerchantIdAndOrderNumberIgnoreCase(UUID merchantId, String orderNumber);

    @Query("""
            SELECT o FROM Order o
            JOIN FETCH o.customer c
            WHERE o.merchantId = :merchantId
              AND o.customer.id = :customerId
            ORDER BY o.createdAt DESC
            """)
    List<Order> findByMerchantIdAndCustomerIdOrderByCreatedAtDesc(
            @Param("merchantId") UUID merchantId,
            @Param("customerId") UUID customerId);

    @Query("""
            SELECT o FROM Order o
            JOIN FETCH o.customer c
            WHERE o.merchantId = :merchantId
            ORDER BY o.createdAt DESC
            """)
    List<Order> findAllByMerchantIdWithCustomerOrderByCreatedAtDesc(
            @Param("merchantId") UUID merchantId);
}
