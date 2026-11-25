package com.ordexa.health.repository;

import com.ordexa.health.entity.SystemBootstrapRecord;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SystemBootstrapRepository extends JpaRepository<SystemBootstrapRecord, Long> {

    Optional<SystemBootstrapRecord> findByComponentCode(String componentCode);
}
