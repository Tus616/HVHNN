package com.hvhn.backend.controller;

import com.hvhn.backend.dto.PresenceView;
import com.hvhn.backend.service.ChatService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/presence")
public class PresenceController {

    private final ChatService chatService;

    public PresenceController(ChatService chatService) {
        this.chatService = chatService;
    }

    @GetMapping("/online-users")
    public ResponseEntity<List<PresenceView>> getOnlineUsers() {
        return ResponseEntity.ok(chatService.getOnlineUsers());
    }
}
