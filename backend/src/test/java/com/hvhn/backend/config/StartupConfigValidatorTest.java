package com.hvhn.backend.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class StartupConfigValidatorTest {

    @Test
    void productionRequiresSecrets() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("prod");

        assertThrows(IllegalStateException.class, () -> new StartupConfigValidator(environment).validateProductionSecrets());
    }

    @Test
    void developmentAllowsLocalDefaults() {
        MockEnvironment environment = new MockEnvironment();

        assertDoesNotThrow(() -> new StartupConfigValidator(environment).validateProductionSecrets());
    }
}
