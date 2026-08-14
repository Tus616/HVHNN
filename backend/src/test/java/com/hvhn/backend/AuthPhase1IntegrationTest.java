package com.hvhn.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hvhn.backend.model.EmailOtpChallenge;
import com.hvhn.backend.repository.EmailOtpChallengeRepository;
import com.hvhn.backend.repository.UserRepository;
import com.hvhn.backend.service.MailjetEmailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.fail;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
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

    @MockBean
    MailjetEmailService mailjetEmailService;

    @BeforeEach
    void resetTestData() {
        guardTestDatabase();
        mongoTemplate.dropCollection(EmailOtpChallenge.class);
        mongoTemplate.dropCollection(com.hvhn.backend.model.User.class);
    }

    @Test
    void registrationEmailOtpOnboardingLoginAndVolunteerSmoke() throws Exception {
        when(mailjetEmailService.isConfigured()).thenReturn(true);

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

        String otp = readOtpFromCapturedEmail(email);

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

    private String readOtpFromCapturedEmail(String email) {
        ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
        try {
            verify(mailjetEmailService).sendEmail(eq(email), anyString(), bodyCaptor.capture());
            String body = bodyCaptor.getValue();
            Matcher matcher = OTP_PATTERN.matcher(body);
            if (matcher.find()) {
                return matcher.group(1);
            }
            fail("OTP pattern not found in captured email body: " + body);
        } catch (Exception e) {
            fail("Failed to capture email via mocked MailjetEmailService: " + e.getMessage());
        }
        return null;
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
