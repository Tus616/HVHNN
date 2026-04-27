package com.hvhn.backend.dto;

import com.hvhn.backend.model.enums.CommunityCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class CommunityUpsertRequest {
    @NotBlank(message = "Community name is required")
    private String name;

    @NotBlank(message = "Community description is required")
    private String description;

    @NotBlank(message = "Community location is required")
    private String location;

    @NotNull(message = "Community category is required")
    private CommunityCategory category;

    private String institutionDomain;
    private String joinCode;

    public CommunityUpsertRequest() {}

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public CommunityCategory getCategory() { return category; }
    public void setCategory(CommunityCategory category) { this.category = category; }

    public String getInstitutionDomain() { return institutionDomain; }
    public void setInstitutionDomain(String institutionDomain) { this.institutionDomain = institutionDomain; }

    public String getJoinCode() { return joinCode; }
    public void setJoinCode(String joinCode) { this.joinCode = joinCode; }
}
