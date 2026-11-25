package com.ordexa.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;

class CorsPropertiesTest {

    @Test
    void resolveOriginListParsesConfiguredOrigins() {
        CorsProperties props = new CorsProperties();
        props.setAllowedOrigins(" http://localhost:5173 , https://app.ordexa.in ");

        List<String> origins = props.resolveOriginList();

        assertThat(origins).containsExactly("http://localhost:5173", "https://app.ordexa.in");
    }

    @Test
    void resolveOriginListRejectsWildcardOrigin() {
        CorsProperties props = new CorsProperties();
        props.setAllowedOrigins("http://localhost:5173,*");

        assertThatThrownBy(props::resolveOriginList)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Wildcard CORS origin");
    }
}
