package com.hvhn.backend.service;

import com.hvhn.backend.dto.PresenceView;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;

@Component
public class ChatWebSocketEventListener {

    private final ChatService chatService;
    private final ChatSessionRegistry chatSessionRegistry;
    private final SimpMessagingTemplate messagingTemplate;

    public ChatWebSocketEventListener(
            ChatService chatService,
            ChatSessionRegistry chatSessionRegistry,
            SimpMessagingTemplate messagingTemplate
    ) {
        this.chatService = chatService;
        this.chatSessionRegistry = chatSessionRegistry;
        this.messagingTemplate = messagingTemplate;
    }

    @EventListener
    public void handleSessionConnected(SessionConnectedEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = accessor.getUser();
        String sessionId = accessor.getSessionId();

        if (principal == null || sessionId == null || sessionId.isBlank()) {
            return;
        }

        boolean firstSession = chatSessionRegistry.registerSession(sessionId, principal.getName());
        if (firstSession) {
            PresenceView presence = chatService.markUserOnline(principal.getName());
            messagingTemplate.convertAndSend("/topic/presence", presence);
        }
    }

    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();

        if (sessionId == null || sessionId.isBlank()) {
            return;
        }

        chatSessionRegistry.unregisterSession(sessionId).ifPresent(userId -> {
            PresenceView presence = chatService.markUserOffline(userId);
            messagingTemplate.convertAndSend("/topic/presence", presence);
        });
    }
}
