package com.hvhn.backend.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminFirebaseTokenVerifierTest {

    @Test
    void productionProfileDoesNotUseUnsafeDecodeWhenFirebaseAuthIsMissing() {
        Environment environment = mock(Environment.class);
        ObjectProvider firebaseAuthProvider = mock(ObjectProvider.class);
        when(environment.getActiveProfiles()).thenReturn(new String[]{"prod"});
        when(firebaseAuthProvider.getIfAvailable()).thenReturn(null);

        AdminFirebaseTokenVerifier verifier = new AdminFirebaseTokenVerifier(
                firebaseAuthProvider,
                environment,
                1,
                0
        );

        assertThatThrownBy(() -> verifier.verify("header.payload.signature"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Firebase authentication is not configured");
    }
}
