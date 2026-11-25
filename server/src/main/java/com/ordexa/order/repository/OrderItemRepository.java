package com.ordexa.order.repository;

import com.ordexa.order.entity.OrderItem;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OrderItemRepository extends JpaRepository<OrderItem, UUID> {

    List<OrderItem> findByOrderIdAndMerchantId(UUID orderId, UUID merchantId);

    List<OrderItem> findByOrderIdInAndMerchantId(Collection<UUID> orderIds, UUID merchantId);
}
