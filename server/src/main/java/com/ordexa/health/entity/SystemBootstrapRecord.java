package com.ordexa.health.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "system_bootstrap_audit")
public class SystemBootstrapRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "component_code", nullable = false, length = 64, unique = true)
    private String componentCode;

    @Column(name = "schema_version", nullable = false, length = 32)
    private String schemaVersion;

    @Column(name = "environment_tag", nullable = false, length = 32)
    private String environmentTag;

    @Column(name = "initialized_at", nullable = false)
    private OffsetDateTime initializedAt;

    protected SystemBootstrapRecord() {
    }

    public Long getId() {
        return id;
    }

    public String getComponentCode() {
        return componentCode;
    }

    public String getSchemaVersion() {
        return schemaVersion;
    }

    public String getEnvironmentTag() {
        return environmentTag;
    }

    public OffsetDateTime getInitializedAt() {
        return initializedAt;
    }
}
