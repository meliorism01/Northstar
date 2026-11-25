package com.ordexa;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class OrdexaApplication {

    public static void main(String[] args) {
        SpringApplication.run(OrdexaApplication.class, args);
    }
}
