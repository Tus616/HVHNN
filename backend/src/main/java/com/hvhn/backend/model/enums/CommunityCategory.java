package com.hvhn.backend.model.enums;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum CommunityCategory {
    BLOOD,
    MEDICAL,
    FOOD,
    COLLEGE,
    HOSPITAL,
    RESIDENTIAL,
    CORPORATE,
    OTHER;

    @JsonCreator
    public static CommunityCategory fromValue(String value) {
        return CommunityCategory.valueOf(value.trim().toUpperCase());
    }
}
