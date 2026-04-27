package com.hvhn.backend.dto;

import java.util.ArrayList;
import java.util.List;

public class VolunteerCategoriesRequest {
    private List<String> categories = new ArrayList<>();

    public List<String> getCategories() { return categories; }
    public void setCategories(List<String> categories) { this.categories = categories; }
}
