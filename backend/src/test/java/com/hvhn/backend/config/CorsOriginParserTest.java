package com.hvhn.backend.config;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class CorsOriginParserTest {

    @Test
    void parsesAndDeduplicatesOrigins() {
        assertEquals(
                List.of("http://localhost:5173", "https://hvhn.web.app"),
                CorsOriginParser.parse(" http://localhost:5173,https://hvhn.web.app,http://localhost:5173 ", false)
        );
    }

    @Test
    void rejectsEmptyCorsConfig() {
        assertThrows(IllegalStateException.class, () -> CorsOriginParser.parse("  ", false));
    }

    @Test
    void rejectsWildcardInProduction() {
        assertThrows(IllegalStateException.class, () -> CorsOriginParser.parse("*", true));
    }
}
