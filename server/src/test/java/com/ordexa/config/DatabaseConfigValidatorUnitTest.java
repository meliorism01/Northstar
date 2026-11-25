package com.ordexa.config;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.mock.env.MockEnvironment;

class DatabaseConfigValidatorUnitTest {

    private final DatabaseConfigValidator validator = new DatabaseConfigValidator();

    @Test
    void supabaseProfileWithoutPasswordFailsFastWithClearError() {
        MockEnvironment env = new MockEnvironment()
                .withProperty("spring.datasource.url", "jdbc:postgresql://aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require")
                .withProperty("spring.datasource.username", "postgres.cumzjxsxjvhhldsjluj")
                .withProperty("spring.datasource.password", "");
        env.setActiveProfiles("supabase");

        GenericApplicationContext ctx = new GenericApplicationContext();
        ctx.setEnvironment(env);

        assertThatThrownBy(() -> validator.initialize(ctx))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Database password is missing")
                .hasMessageContaining("SUPABASE_DB_PASSWORD");
    }

    @Test
    void supabaseProfileWithPasswordPassesValidation() {
        MockEnvironment env = new MockEnvironment()
                .withProperty("spring.datasource.url", "jdbc:postgresql://aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require")
                .withProperty("spring.datasource.username", "postgres.cumzjxsxjvhhldsjluj")
                .withProperty("spring.datasource.password", "dummy-non-empty-test-value");
        env.setActiveProfiles("supabase");

        GenericApplicationContext ctx = new GenericApplicationContext();
        ctx.setEnvironment(env);

        assertThatCode(() -> validator.initialize(ctx)).doesNotThrowAnyException();
    }

    @Test
    void localProfileDoesNotRequireStrictCloudValidation() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("local");

        GenericApplicationContext ctx = new GenericApplicationContext();
        ctx.setEnvironment(env);

        assertThatCode(() -> validator.initialize(ctx)).doesNotThrowAnyException();
    }
}
