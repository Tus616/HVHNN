package com.hvhn.backend.config;

import com.hvhn.backend.model.Community;
import com.hvhn.backend.model.HelpRequest;
import com.hvhn.backend.model.Member;
import com.hvhn.backend.model.Request;
import com.hvhn.backend.model.User;
import com.hvhn.backend.model.enums.CommunityCategory;
import com.hvhn.backend.model.enums.MemberRole;
import com.hvhn.backend.model.enums.RequestStatus;
import com.hvhn.backend.model.enums.RequestUrgency;
import com.hvhn.backend.repository.CommunityRepository;
import com.hvhn.backend.repository.HelpRequestRepository;
import com.hvhn.backend.repository.MemberRepository;
import com.hvhn.backend.repository.RequestRepository;
import com.hvhn.backend.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Component
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final CommunityRepository communityRepository;
    private final MemberRepository memberRepository;
    private final RequestRepository communityRequestRepository;
    private final HelpRequestRepository helpRequestRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(UserRepository userRepository,
                           CommunityRepository communityRepository,
                           MemberRepository memberRepository,
                           RequestRepository communityRequestRepository,
                           HelpRequestRepository helpRequestRepository,
                           PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.communityRepository = communityRepository;
        this.memberRepository = memberRepository;
        this.communityRequestRepository = communityRequestRepository;
        this.helpRequestRepository = helpRequestRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        User admin = seedUserIfMissing("admin@hvhn.com", "admin123", "Admin User", "ADMIN",
                "+91-9999000001", "Central Delhi", 28.6139, 77.2090, 500, 0, 0, true);
        User user1 = seedUserIfMissing("rahul@example.com", "pass123", "Rahul Sharma", "USER",
                "+91-9999000002", "South Delhi", 28.5459, 77.1926, 120, 5, 3, true);
        User user2 = seedUserIfMissing("priya@example.com", "pass123", "Priya Patel", "USER",
                "+91-9999000003", "AIIMS Campus", 28.5672, 77.2100, 250, 12, 2, true);
        User user3 = seedUserIfMissing("amit@example.com", "pass123", "Amit Kumar", "USER",
                "+91-9999000004", "Sector 62, Noida", 28.6270, 77.3649, 75, 3, 4, true);
        seedUserIfMissing("sneha@example.com", "pass123", "Sneha Gupta", "USER",
                "+91-9999000005", "Dwarka, Delhi", 28.5921, 77.0460, 180, 8, 1, true);
        seedUserIfMissing("aarti.mehra@iitd.ac.in", "pass123", "Aarti Mehra", "USER",
                "+91-9999000006", "Faculty Housing, IIT Delhi", 28.5442, 77.1929, 264, 13, 2, true);
        seedUserIfMissing("farhan.ali@alumni.iitd.ac.in", "pass123", "Farhan Ali", "USER",
                "+91-9999000007", "Hauz Khas Extension", 28.5506, 77.2001, 94, 4, 1, true);
        seedUserIfMissing("raghav.menon@aiims.edu", "pass123", "Dr. Raghav Menon", "USER",
                "+91-9999000008", "Ansari Nagar", 28.5663, 77.2093, 420, 18, 0, true);
        seedUserIfMissing("kavya.bansal@aiims.edu", "pass123", "Kavya Bansal", "USER",
                "+91-9999000009", "South Extension", 28.5690, 77.2245, 146, 6, 1, true);
        seedUserIfMissing("neha.arora@gvs.com", "pass123", "Neha Arora", "USER",
                "+91-9999000010", "Tower C, Green Valley Society", 28.6273, 77.3651, 132, 7, 1, true);
        seedUserIfMissing("abhishek.jain@gvs.com", "pass123", "Abhishek Jain", "USER",
                "+91-9999000011", "Tower A, Green Valley Society", 28.6272, 77.3647, 88, 5, 1, true);
        seedUserIfMissing("sana.khan@gvs.com", "pass123", "Sana Khan", "USER",
                "+91-9999000012", "Tower B, Green Valley Society", 28.6274, 77.3650, 204, 11, 2, true);

        configureVolunteer(admin, 0.0, false, List.of(), "OFFLINE");
        configureVolunteer(user1, 4.6, true, List.of("GENERAL", "FOOD"), "ONLINE");
        configureVolunteer(user2, 4.8, true, List.of("BLOOD", "MEDICAL"), "ONLINE");
        configureVolunteer(user3, 4.5, true, List.of("FOOD", "GENERAL"), "ONLINE");
        userRepository.findByEmail("sneha@example.com").ifPresent(user -> configureVolunteer(user, 4.9, true, List.of("FOOD", "GENERAL"), "ONLINE"));
        userRepository.findByEmail("aarti.mehra@iitd.ac.in").ifPresent(user -> configureVolunteer(user, 4.9, true, List.of("GENERAL"), "ONLINE"));
        userRepository.findByEmail("farhan.ali@alumni.iitd.ac.in").ifPresent(user -> configureVolunteer(user, 4.7, true, List.of("GENERAL"), "ONLINE"));
        userRepository.findByEmail("raghav.menon@aiims.edu").ifPresent(user -> configureVolunteer(user, 5.0, true, List.of("MEDICAL"), "ONLINE"));
        userRepository.findByEmail("kavya.bansal@aiims.edu").ifPresent(user -> configureVolunteer(user, 4.8, true, List.of("MEDICAL"), "ONLINE"));
        userRepository.findByEmail("neha.arora@gvs.com").ifPresent(user -> configureVolunteer(user, 4.9, true, List.of("GENERAL", "FOOD"), "ONLINE"));
        userRepository.findByEmail("abhishek.jain@gvs.com").ifPresent(user -> configureVolunteer(user, 4.7, true, List.of("GENERAL"), "ONLINE"));
        userRepository.findByEmail("sana.khan@gvs.com").ifPresent(user -> configureVolunteer(user, 4.9, true, List.of("FOOD", "GENERAL"), "ONLINE"));

        if (communityRepository.count() > 0 || memberRepository.count() > 0
                || communityRequestRepository.count() > 0 || helpRequestRepository.count() > 0) {
            return;
        }

        Community bloodCommunity = communityRepository.save(new Community(
                "Delhi Blood Donors Circle",
                "Verified local donors coordinating urgent blood support across South Delhi.",
                "South Delhi",
                CommunityCategory.BLOOD
        ));
        Community medicalCommunity = communityRepository.save(new Community(
                "AIIMS Medical Support",
                "Caregivers, patients, and volunteers sharing verified medical help around AIIMS.",
                "New Delhi",
                CommunityCategory.MEDICAL
        ));
        Community foodCommunity = communityRepository.save(new Community(
                "Noida Community Kitchen",
                "Neighbors organizing food packets and meal delivery for families in need.",
                "Noida",
                CommunityCategory.FOOD
        ));

        addMember(bloodCommunity, admin, MemberRole.ADMIN);
        addMember(medicalCommunity, admin, MemberRole.ADMIN);
        addMember(foodCommunity, admin, MemberRole.ADMIN);
        addMember(bloodCommunity, user1, MemberRole.MODERATOR);
        addMember(medicalCommunity, user2, MemberRole.ADMIN);
        addMember(foodCommunity, user3, MemberRole.ADMIN);
        addMember(foodCommunity, user1, MemberRole.MEMBER);

        Request communityRequest1 = new Request();
        communityRequest1.setCommunityId(bloodCommunity.getId());
        communityRequest1.setTitle("Need O+ donors for emergency surgery");
        communityRequest1.setDescription("Two O+ donors are needed near Hauz Khas before 8 PM today.");
        communityRequest1.setLocation("Hauz Khas, New Delhi");
        communityRequest1.setUrgency(RequestUrgency.HIGH);
        communityRequest1.setStatus(RequestStatus.PENDING);
        communityRequest1.setRequestedBy(user1.getId());
        communityRequestRepository.save(communityRequest1);

        Request communityRequest2 = new Request();
        communityRequest2.setCommunityId(foodCommunity.getId());
        communityRequest2.setTitle("Meal packets for stranded workers");
        communityRequest2.setDescription("Looking for volunteers to distribute 25 meal packets near Sector 62.");
        communityRequest2.setLocation("Sector 62, Noida");
        communityRequest2.setUrgency(RequestUrgency.MEDIUM);
        communityRequest2.setStatus(RequestStatus.ACCEPTED);
        communityRequest2.setRequestedBy(user3.getId());
        communityRequestRepository.save(communityRequest2);

        HelpRequest req1 = new HelpRequest();
        req1.setTitle("Urgent: B+ Blood Needed");
        req1.setDescription("Patient in ICU needs B+ blood urgently. 3 units required. Contact ward number 5.");
        req1.setCategory("BLOOD_DONATION");
        req1.setUrgency("CRITICAL");
        req1.setStatus("OPEN");
        req1.setLatitude(28.5672);
        req1.setLongitude(77.2100);
        req1.setAddress("AIIMS Delhi, Ward 5");
        req1.setContactPhone("+91-9999000003");
        req1.setRequesterId(user2.getId());
        req1.setRequesterName(user2.getFullName());
        req1.setCommunityId(medicalCommunity.getId());
        req1.setCommunityName(medicalCommunity.getName());
        req1.setAiCategory("BLOOD_DONATION");
        req1.setAiUrgency("CRITICAL");
        req1.setAiSummary("AI Analysis: CRITICAL urgency blood donation request. Patient needs B+ blood in ICU.");
        req1.setViewCount(45);
        helpRequestRepository.save(req1);

        HelpRequest req2 = new HelpRequest();
        req2.setTitle("Need Medicine Delivery");
        req2.setDescription("Elderly person needs diabetes medicine delivered from pharmacy. Cannot leave home due to mobility issues.");
        req2.setCategory("MEDICAL");
        req2.setUrgency("HIGH");
        req2.setStatus("OPEN");
        req2.setLatitude(28.6270);
        req2.setLongitude(77.3649);
        req2.setAddress("Block A, Sector 62, Noida");
        req2.setContactPhone("+91-9999000004");
        req2.setRequesterId(user3.getId());
        req2.setRequesterName(user3.getFullName());
        req2.setCommunityId(foodCommunity.getId());
        req2.setCommunityName(foodCommunity.getName());
        req2.setAiCategory("MEDICAL");
        req2.setAiUrgency("HIGH");
        req2.setAiSummary("AI Analysis: HIGH urgency medical request. Medicine delivery needed for elderly patient.");
        req2.setViewCount(22);
        helpRequestRepository.save(req2);

        HelpRequest req3 = new HelpRequest();
        req3.setTitle("Food packets for flood-affected families");
        req3.setDescription("10 families displaced due to waterlogging need food packets. Can someone help with meal preparation or food supplies?");
        req3.setCategory("FOOD");
        req3.setUrgency("HIGH");
        req3.setStatus("ACTIVE");
        req3.setLatitude(28.5459);
        req3.setLongitude(77.1926);
        req3.setAddress("Near Hauz Khas Metro Station");
        req3.setRequesterId(user1.getId());
        req3.setRequesterName(user1.getFullName());
        req3.setVolunteerId(user2.getId());
        req3.setVolunteerName(user2.getFullName());
        req3.setCommunityId(foodCommunity.getId());
        req3.setCommunityName(foodCommunity.getName());
        req3.setAcceptedAt(LocalDateTime.now().minusHours(2));
        req3.setVolunteerProgressStatus("ON_THE_WAY");
        req3.setVolunteerStatusUpdatedAt(LocalDateTime.now().minusHours(1));
        req3.setAiCategory("FOOD");
        req3.setAiUrgency("HIGH");
        req3.setAiSummary("AI Analysis: HIGH urgency food support request for flood-displaced families.");
        req3.setViewCount(67);
        req3.setResponseCount(3);
        helpRequestRepository.save(req3);

        HelpRequest req4 = new HelpRequest();
        req4.setTitle("Transport to hospital needed");
        req4.setDescription("Need a vehicle to transport injured person to hospital. Ambulance is taking too long to respond.");
        req4.setCategory("TRANSPORT");
        req4.setUrgency("CRITICAL");
        req4.setStatus("COMPLETED");
        req4.setLatitude(28.6139);
        req4.setLongitude(77.2090);
        req4.setAddress("Connaught Place, New Delhi");
        req4.setRequesterId(user1.getId());
        req4.setRequesterName(user1.getFullName());
        req4.setVolunteerId(user3.getId());
        req4.setVolunteerName(user3.getFullName());
        req4.setAcceptedAt(LocalDateTime.now().minusDays(1));
        req4.setCompletedAt(LocalDateTime.now().minusHours(20));
        req4.setVolunteerProgressStatus("COMPLETED");
        req4.setVolunteerStatusUpdatedAt(LocalDateTime.now().minusHours(20));
        req4.setRequesterRatingPending(true);
        req4.setAiCategory("TRANSPORT");
        req4.setAiUrgency("CRITICAL");
        req4.setViewCount(120);
        req4.setResponseCount(5);
        helpRequestRepository.save(req4);

        System.out.println("=== Sahay Demo Data Initialized ===");
        System.out.println("Admin: admin@hvhn.com / admin123");
        System.out.println("User1: rahul@example.com / pass123");
        System.out.println("User2: priya@example.com / pass123");
        System.out.println("User3: amit@example.com / pass123");
    }

    private User buildUser(String email,
                           String password,
                           String fullName,
                           String role,
                           String phone,
                           String address,
                           double latitude,
                           double longitude,
                           int points,
                           int requestsHelped,
                           int requestsCreated,
                           boolean verified) {
        User user = new User(email, passwordEncoder.encode(password), fullName);
        user.setRole(role);
        user.setPhone(phone);
        user.setAddress(address);
        user.setLatitude(latitude);
        user.setLongitude(longitude);
        user.setPoints(points);
        user.setRequestsHelped(requestsHelped);
        user.setRequestsCreated(requestsCreated);
        user.setVerified(verified);
        return user;
    }

    private User seedUserIfMissing(String email,
                                   String password,
                                   String fullName,
                                   String role,
                                   String phone,
                                   String address,
                                   double latitude,
                                   double longitude,
                                   int points,
                                   int requestsHelped,
                                   int requestsCreated,
                                   boolean verified) {
        return userRepository.findByEmail(email)
                .orElseGet(() -> userRepository.save(buildUser(
                        email,
                        password,
                        fullName,
                        role,
                        phone,
                        address,
                        latitude,
                        longitude,
                        points,
                        requestsHelped,
                        requestsCreated,
                        verified
                )));
    }

    private void configureVolunteer(User user,
                                    double rating,
                                    boolean isVolunteer,
                                    List<String> categories,
                                    String volunteerStatus) {
        user.setRating(rating);
        user.setRatingCount(user.getRequestsHelped());
        user.setTotalHelpCount(user.getRequestsHelped());
        user.setVolunteer(isVolunteer);
        user.setVolunteerCategories(categories);
        user.setVolunteerStatus(isVolunteer ? volunteerStatus : "OFFLINE");
        userRepository.save(user);
    }

    private void addMember(Community community, User user, MemberRole role) {
        Member member = memberRepository.save(new Member(user.getId(), community.getId(), role));
        List<String> memberIds = new ArrayList<>(community.getMemberIds());
        memberIds.add(user.getId());
        community.setMemberIds(memberIds);
        communityRepository.save(community);
    }
}
