package com.hvhn.backend.dto;

import com.hvhn.backend.model.enums.MemberRole;
import jakarta.validation.constraints.NotNull;

public class MemberRoleUpdateRequest {
    @NotNull(message = "Member role is required")
    private MemberRole role;

    public MemberRoleUpdateRequest() {}

    public MemberRole getRole() { return role; }
    public void setRole(MemberRole role) { this.role = role; }
}
