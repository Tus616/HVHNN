package com.hvhn.backend.service;

import java.util.ArrayList;
import java.util.List;

public final class VolunteerBadgeSupport {

    private VolunteerBadgeSupport() {
    }

    public static List<String> badgesFor(int totalHelpCount) {
        List<String> badges = new ArrayList<>();

        if (totalHelpCount >= 1) {
            badges.add("Helper");
        }
        if (totalHelpCount >= 5) {
            badges.add("Rising Star");
        }
        if (totalHelpCount >= 20) {
            badges.add("Active Volunteer");
        }
        if (totalHelpCount >= 50) {
            badges.add("Community Hero");
        }

        return badges;
    }

    public static String highestBadge(int totalHelpCount) {
        List<String> badges = badgesFor(totalHelpCount);
        return badges.isEmpty() ? null : badges.get(badges.size() - 1);
    }
}
