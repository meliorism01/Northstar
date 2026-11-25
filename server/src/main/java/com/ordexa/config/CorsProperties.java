package com.ordexa.config;

import java.util.Arrays;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "ordexa.cors")
public class CorsProperties {

    private String allowedOrigins = "http://localhost:5173,http://127.0.0.1:5173";

    public String getAllowedOrigins() {
        return allowedOrigins;
    }

    public void setAllowedOrigins(String allowedOrigins) {
        this.allowedOrigins = allowedOrigins;
    }

    public List<String> resolveOriginList() {
        if (allowedOrigins == null || allowedOrigins.isBlank()) {
            return List.of("http://localhost:5173", "http://127.0.0.1:5173");
        }
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toList();

        for (String origin : origins) {
            if ("*".equals(origin)) {
                throw new IllegalStateException(
                        "Wildcard CORS origin ('*') is prohibited when credentials are supported.");
            }
        }
        return origins;
    }
}
