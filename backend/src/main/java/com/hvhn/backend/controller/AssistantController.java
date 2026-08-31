package com.hvhn.backend.controller;

import com.hvhn.backend.model.User;
import com.hvhn.backend.service.AssistantService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/assistant")
public class AssistantController {

    private final AssistantService assistantService;

    public AssistantController(AssistantService assistantService) {
        this.assistantService = assistantService;
    }

    @PostMapping("/chat")
    public ResponseEntity<Map<String, Object>> chat(@AuthenticationPrincipal User user,
                                                    @RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(assistantService.chat(user, payload));
    }
}
