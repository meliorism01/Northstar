package com.ordexa.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI ordexaOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("NORTHSTAR API")
                        .version("v1")
                        .description(
                                "NORTHSTAR — Navigate Commerce with Clarity. AI-Powered Order Management, "
                                + "Customer Intelligence Graph, and RTO Prevention SaaS Platform API Foundation.")
                        .contact(new Contact()
                                .name("NORTHSTAR Platform Engineering")));
    }
}
