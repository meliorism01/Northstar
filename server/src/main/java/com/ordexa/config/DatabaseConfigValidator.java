package com.ordexa.config;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.util.StringUtils;

/**
 * Fails fast before HikariCP initialization when cloud or production profiles
 * are active without a configured database password. Never logs secret values
 * or full JDBC URLs.
 */
public class DatabaseConfigValidator implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    private static final Set<String> STRICT_PROFILES = Set.of("supabase", "prod");

    @Override
    public void initialize(ConfigurableApplicationContext applicationContext) {
        ConfigurableEnvironment env = applicationContext.getEnvironment();
        Set<String> activeProfiles = Arrays.stream(env.getActiveProfiles())
                .map(String::trim)
                .map(String::toLowerCase)
                .collect(Collectors.toSet());

        boolean requiresStrictCredentials = activeProfiles.stream().anyMatch(STRICT_PROFILES::contains);
        if (!requiresStrictCredentials) {
            return;
        }

        String url = env.getProperty("spring.datasource.url");
        String username = env.getProperty("spring.datasource.username");
        String password = env.getProperty("spring.datasource.password");

        if (!StringUtils.hasText(url)) {
            throw new IllegalStateException(
                    "Database URL is not configured for active profile(s) " + activeProfiles
                            + ". Set SPRING_DATASOURCE_URL or SUPABASE_DB_HOST/PORT/NAME.");
        }

        if (!StringUtils.hasText(username)) {
            throw new IllegalStateException(
                    "Database username is not configured for active profile(s) " + activeProfiles
                            + ". Set SPRING_DATASOURCE_USERNAME or SUPABASE_DB_USERNAME.");
        }

        if (!StringUtils.hasText(password)) {
            throw new IllegalStateException(
                    "Database password is missing for active profile(s) " + activeProfiles
                            + ". Set SUPABASE_DB_PASSWORD or SPRING_DATASOURCE_PASSWORD in your local environment or .env file.");
        }
    }
}
