package com.hvhn.backend.model.enums;

import java.util.Locale;
import java.util.Map;
import java.util.Set;

public enum VolunteerCategory {
    BLOOD_DONATION("Blood Donation", Set.of("BLOOD")),
    MEDICAL("Medical", Set.of("MEDICAL_EMERGENCY")),
    FOOD("Food", Set.of("FOOD_SUPPORT")),
    TRANSPORT("Transport", Set.of("DRIVER")),
    EMERGENCY("Emergency", Set.of("SOS", "CRITICAL")),
    GENERAL("General", Set.of("OTHER"));

    private static final Map<String, VolunteerCategory> DIRECT = Map.of(
            "BLOOD_DONATION", BLOOD_DONATION,
            "MEDICAL", MEDICAL,
            "FOOD", FOOD,
            "TRANSPORT", TRANSPORT,
            "EMERGENCY", EMERGENCY,
            "GENERAL", GENERAL
    );

    private final String label;
    private final Set<String> legacyValues;

    VolunteerCategory(String label, Set<String> legacyValues) {
        this.label = label;
        this.legacyValues = legacyValues;
    }

    public String getLabel() {
        return label;
    }

    public static VolunteerCategory fromApiValue(String value) {
        String normalized = normalize(value);
        VolunteerCategory direct = DIRECT.get(normalized);
        if (direct != null) return direct;

        for (VolunteerCategory category : values()) {
            if (category.legacyValues.contains(normalized)) return category;
        }

        throw new IllegalArgumentException("Unsupported volunteer category: " + value);
    }

    public static String canonicalize(String value) {
        return fromApiValue(value).name();
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
    }
}
