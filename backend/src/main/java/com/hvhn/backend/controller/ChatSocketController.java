package com.hvhn.backend.controller;

import com.hvhn.backend.dto.ChatMessagePayload;
import com.hvhn.backend.dto.ChatMessageView;
import com.hvhn.backend.dto.PresenceUpdateRequest;
import com.hvhn.backend.dto.PresenceView;
import com.hvhn.backend.dto.TypingEventPayload;
import com.hvhn.backend.dto.TypingEventView;
import com.hvhn.backend.dto.UnreadUpdateResponse;
import com.hvhn.backend.model.User;
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
        boolean duplicateClientMessage = chatService.hasMessageFromClientId(userId, payload.getClientMessageId());
        ChatMessageView message = chatService.handleIncomingMessage(userId, payload);
        if (duplicateClientMessage) {
            messagingTemplate.convertAndSendToUser(userId, "/queue/chat/messages", message);
            return;
        }
        messagingTemplate.convertAndSend("/topic/chat/" + payload.getRoomId(), message);

        for (String participantId : chatService.getParticipantIds(payload.getRoomId())) {
            ChatRoomViewAdapter roomView = new ChatRoomViewAdapter(chatService.getRoomViewForUser(payload.getRoomId(), participantId));
            messagingTemplate.convertAndSend("/topic/rooms/" + participantId, roomView.value());
            messagingTemplate.convertAndSendToUser(participantId, "/queue/chat/messages", message);
            messagingTemplate.convertAndSendToUser(participantId, "/queue/chat/conversations", roomView.value());
        }
        for (var receiptEvent : chatService.getReceiptEventsForMessage(message.getId(), "DELIVERED", 0)) {
            if (receiptEvent.getDeliveredAt() != null) {
                messagingTemplate.convertAndSendToUser(userId, "/queue/chat/receipts", receiptEvent);
            }
        }
    }

    @MessageMapping("/chat.seen")
    public void markSeen(@Payload ChatSeenPayload payload, Principal principal) {
        String userId = requireUserId(principal);
        UnreadUpdateResponse response = chatService.markSeen(new UserPrincipal(userId), payload.roomId(), payload.lastSeenMessageId());
        for (String participantId : chatService.getParticipantIds(payload.roomId())) {
            messagingTemplate.convertAndSendToUser(participantId, "/queue/chat/receipts", response);
        }
        for (var receiptEvent : chatService.getReceiptEventsForMessage(payload.lastSeenMessageId(), "SEEN", 0)) {
            if (receiptEvent.getSeenAt() != null) {
                for (String participantId : chatService.getParticipantIds(payload.roomId())) {
                    messagingTemplate.convertAndSendToUser(participantId, "/queue/chat/receipts", receiptEvent);
                }
            }
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

    public record ChatSeenPayload(String roomId, String lastSeenMessageId) {}

    private record ChatRoomViewAdapter(com.hvhn.backend.dto.ChatRoomView value) {}

    private static class UserPrincipal extends User {
        UserPrincipal(String id) {
            setId(id);
        }
    }
}
