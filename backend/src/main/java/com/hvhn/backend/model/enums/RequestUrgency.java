package com.hvhn.backend.model.enums;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum RequestUrgency {
    LOW,
    MEDIUM,
    HIGH;

    @JsonCreator
    public static RequestUrgency fromValue(String value) {
        return RequestUrgency.valueOf(value.trim().toUpperCase());
    }
}
