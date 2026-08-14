package com.hvhn.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hvhn.backend.model.EmailOtpChallenge;
import com.hvhn.backend.repository.EmailOtpChallengeRepository;
import com.hvhn.backend.repository.UserRepository;
import com.icegreen.greenmail.junit5.GreenMailExtension;
import com.icegreen.greenmail.util.ServerSetup;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.fail;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthPhase1IntegrationTest {

    private static final Pattern OTP_PATTERN = Pattern.compile("Your Sahay verification code is: (\\d{6})\\.");

    @RegisterExtension
    static GreenMailExtension greenMail = new GreenMailExtension(new ServerSetup(3025, null, ServerSetup.PROTOCOL_SMTP));

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    MongoTemplate mongoTemplate;

    @Autowired
    UserRepository userRepository;

    @Autowired
    EmailOtpChallengeRepository challengeRepository;

    @BeforeEach
    void resetTestData() throws Exception {
        guardTestDatabase();
        mongoTemplate.dropCollection(EmailOtpChallenge.class);
        mongoTemplate.dropCollection(com.hvhn.backend.model.User.class);
        greenMail.purgeEmailFromAllMailboxes();
    }

    @Test
    void registrationEmailOtpOnboardingLoginAndVolunteerSmoke() throws Exception {
        String email = "phase1-" + System.nanoTime() + "@hvhn.test";
        String password = "StrongPass123";

        mockMvc.perform(post("/api/auth/register/request-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json("""
                                {"email":"%s"}
                                """, email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").exists())
                .andExpect(jsonPath("$.otp").doesNotExist());

        assertThat(challengeRepository.findByNormalizedEmailAndPurposeAndConsumedFalse(
                email, EmailOtpChallenge.PURPOSE_REGISTRATION)).hasSize(1);

        String otp = readOtpFromCapturedEmail();

        mockMvc.perform(post("/api/auth/register/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json("""
                                {"email":"%s","otp":"000000","password":"%s","fullName":"Phase Tester","phone":"9999999999"}
                                """, email, password)))
                .andExpect(status().isUnprocessableEntity());

        String registerBody = mockMvc.perform(post("/api/auth/register/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json("""
                                {"email":"%s","otp":"%s","password":"%s","fullName":"Phase Tester","phone":"9999999999"}
                                """, email, otp, password)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.onboardingCompleted").value(false))
                .andReturn()
                .getResponse()
                .getContentAsString();

        assertThat(userRepository.findByNormalizedEmail(email)).isPresent();
        assertThat(userRepository.findAll().stream().filter(user -> email.equals(user.getNormalizedEmail())).count()).isEqualTo(1);

        String token = objectMapper.readTree(registerBody).get("token").asText();
        assertIncompleteProfile(token);

        mockMvc.perform(put("/api/users/me/onboarding")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Phase Tester","phone":"9999999999","city":"Test City","volunteerEnabled":false,"volunteerCategories":[]}
                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.onboardingCompleted").value(true))
                .andExpect(jsonPath("$.isVolunteer").value(false));

        assertCompleteProfile(token);

        String loginBody = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json("""
                                {"email":"%s","password":"%s"}
                                """, email, password)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.onboardingCompleted").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString();

        String loginToken = objectMapper.readTree(loginBody).get("token").asText();

        mockMvc.perform(put("/api/users/me/onboarding")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + loginToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Phase Tester","phone":"9999999999","volunteerEnabled":true,"volunteerCategories":["BLOOD_DONATION","TRANSPORT"]}
                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.onboardingCompleted").value(true))
                .andExpect(jsonPath("$.isVolunteer").value(true))
                .andExpect(jsonPath("$.volunteerCategories[0]").value("BLOOD_DONATION"))
                .andExpect(jsonPath("$.volunteerCategories[1]").value("TRANSPORT"));

        mockMvc.perform(put("/api/users/me/onboarding")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + loginToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Phase Tester","phone":"9999999999","volunteerEnabled":false,"volunteerCategories":["BLOOD_DONATION"]}
                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.onboardingCompleted").value(true))
                .andExpect(jsonPath("$.isVolunteer").value(false))
                .andExpect(jsonPath("$.volunteerCategories").isEmpty());

        mockMvc.perform(get("/api/users/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer invalid.jwt.value"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/auth/register/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json("""
                                {"email":"%s","otp":"%s","password":"%s","fullName":"Phase Tester","phone":"9999999999"}
                                """, email, otp, password)))
                .andExpect(status().isUnprocessableEntity());

        assertThat(userRepository.findAll().stream().filter(user -> email.equals(user.getNormalizedEmail())).count()).isEqualTo(1);
    }

    private void assertIncompleteProfile(String token) throws Exception {
        mockMvc.perform(get("/api/users/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.onboardingCompleted").value(false));
    }

    private void assertCompleteProfile(String token) throws Exception {
        mockMvc.perform(get("/api/users/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.onboardingCompleted").value(true));
    }

    private String readOtpFromCapturedEmail() throws Exception {
        if (!greenMail.waitForIncomingEmail(5000, 1)) {
            fail("Expected one captured OTP email");
        }
        MimeMessage[] messages = greenMail.getReceivedMessages();
        assertThat(messages).hasSize(1);
        String body = String.valueOf(messages[0].getContent());
        Matcher matcher = OTP_PATTERN.matcher(body);
        assertThat(matcher.find()).isTrue();
        return matcher.group(1);
    }

    private void guardTestDatabase() {
        String databaseName = mongoTemplate.getDb().getName();
        assertThat(databaseName)
                .as("Integration tests must use an explicit test MongoDB database")
                .containsIgnoringCase("test");
    }

    private String json(String template, Object... args) {
        return String.format(template, args);
    }
}
