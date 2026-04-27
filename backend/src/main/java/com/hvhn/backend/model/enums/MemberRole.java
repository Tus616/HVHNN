package com.hvhn.backend.model.enums;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum MemberRole {
    ADMIN,
    MODERATOR,
    MEMBER;

    @JsonCreator
    public static MemberRole fromValue(String value) {
        return MemberRole.valueOf(value.trim().toUpperCase());
    }
}
