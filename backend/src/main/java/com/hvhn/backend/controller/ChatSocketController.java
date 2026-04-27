package com.hvhn.backend.controller;

import com.hvhn.backend.dto.ChatMessagePayload;
import com.hvhn.backend.dto.ChatMessageView;
import com.hvhn.backend.dto.PresenceUpdateRequest;
import com.hvhn.backend.dto.PresenceView;
import com.hvhn.backend.dto.TypingEventPayload;
import com.hvhn.backend.dto.TypingEventView;
import com.hvhn.backend.service.ChatService;
import jakarta.validation.Valid;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
public class ChatSocketController {

    private final ChatService chatService;
    private final SimpMessagingTemplate messagingTemplate;

    public ChatSocketController(ChatService chatService, SimpMessagingTemplate messagingTemplate) {
        this.chatService = chatService;
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/chat.send")
    public void sendMessage(@Valid @Payload ChatMessagePayload payload, Principal principal) {
        String userId = requireUserId(principal);
        ChatMessageView message = chatService.handleIncomingMessage(userId, payload);
        messagingTemplate.convertAndSend("/topic/chat/" + payload.getRoomId(), message);

        for (String participantId : chatService.getParticipantIds(payload.getRoomId())) {
            messagingTemplate.convertAndSend(
                    "/topic/rooms/" + participantId,
                    chatService.getRoomViewForUser(payload.getRoomId(), participantId)
            );
        }
    }

    @MessageMapping("/chat.typing")
    public void sendTyping(@Valid @Payload TypingEventPayload payload, Principal principal) {
        TypingEventView typingEvent = chatService.buildTypingEvent(requireUserId(principal), payload);
        messagingTemplate.convertAndSend("/topic/typing/" + payload.getRoomId(), typingEvent);
    }

    @MessageMapping("/presence.update")
    public void updatePresence(@Valid @Payload PresenceUpdateRequest payload, Principal principal) {
        PresenceView presence = chatService.updatePresence(requireUserId(principal), payload.getStatus());
        messagingTemplate.convertAndSend("/topic/presence", presence);
    }

    private String requireUserId(Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw new IllegalArgumentException("WebSocket authentication is required");
        }
        return principal.getName();
    }
}
