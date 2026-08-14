package com.hvhn.backend.exception;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class GlobalExceptionHandlerTest {

    @Test
    void unexpectedRuntimeExceptionMapsToInternalServerError() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/test");
        request.setAttribute("requestId", "test-request-id");

        var response = new GlobalExceptionHandler().handleRuntimeException(new RuntimeException("boom"), request);

        assertEquals(500, response.getStatusCode().value());
        assertEquals("An unexpected error occurred", response.getBody().getMessage());
        assertEquals("test-request-id", response.getBody().getRequestId());
        assertNotNull(response.getBody().getTimestamp());
    }
}
