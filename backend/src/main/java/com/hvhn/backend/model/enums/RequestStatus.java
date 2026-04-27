package com.hvhn.backend.model.enums;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum RequestStatus {
    PENDING,
    ACCEPTED,
    COMPLETED;

    @JsonCreator
    public static RequestStatus fromValue(String value) {
        return RequestStatus.valueOf(value.trim().toUpperCase());
    }
}
