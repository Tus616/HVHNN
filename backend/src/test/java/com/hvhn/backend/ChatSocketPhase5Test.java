package com.hvhn.backend;

import com.hvhn.backend.controller.ChatSocketController;
import com.hvhn.backend.dto.ChatMessagePayload;
import com.hvhn.backend.dto.ChatMessageView;
import com.hvhn.backend.dto.ChatRoomView;
import com.hvhn.backend.dto.TypingEventPayload;
import com.hvhn.backend.dto.TypingEventView;
import com.hvhn.backend.dto.UnreadUpdateResponse;
import com.hvhn.backend.model.enums.ChatMessageType;
import com.hvhn.backend.service.ChatService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.security.Principal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ChatSocketPhase5Test {

    private final ChatService chatService = mock(ChatService.class);
    private final SimpMessagingTemplate messagingTemplate = mock(SimpMessagingTemplate.class);
    private final ChatSocketController controller = new ChatSocketController(chatService, messagingTemplate);

    @Test
    void sendMessagePublishesLegacyTopicAndAuthenticatedUserQueuesWithoutDuplicates() {
        ChatMessagePayload payload = new ChatMessagePayload();
        payload.setRoomId("room-1");
        payload.setContent("socket test");
        payload.setMessageType(ChatMessageType.CHAT);
        payload.setClientMessageId("client-1");

        ChatMessageView message = new ChatMessageView();
        message.setId("message-1");
        message.setRoomId("room-1");
        message.setClientMessageId("client-1");
        when(chatService.handleIncomingMessage("user-a", payload)).thenReturn(message);
        when(chatService.getParticipantIds("room-1")).thenReturn(List.of("user-a", "user-b"));
        ChatRoomView roomA = new ChatRoomView();
        roomA.setId("room-1");
        ChatRoomView roomB = new ChatRoomView();
        roomB.setId("room-1");
        when(chatService.getRoomViewForUser("room-1", "user-a")).thenReturn(roomA);
        when(chatService.getRoomViewForUser("room-1", "user-b")).thenReturn(roomB);

        controller.sendMessage(payload, principal("user-a"));

        verify(messagingTemplate).convertAndSend("/topic/chat/room-1", message);
        verify(messagingTemplate).convertAndSendToUser("user-a", "/queue/chat/messages", message);
        verify(messagingTemplate).convertAndSendToUser("user-b", "/queue/chat/messages", message);
        verify(messagingTemplate).convertAndSendToUser("user-a", "/queue/chat/conversations", roomA);
        verify(messagingTemplate).convertAndSendToUser("user-b", "/queue/chat/conversations", roomB);
    }

    @Test
    void seenAcknowledgementNotifiesSenderAndRecipientReceiptQueues() {
        UnreadUpdateResponse response = new UnreadUpdateResponse();
        response.setRoomId("room-1");
        response.setUnreadCount(0);
        when(chatService.markSeen(any(), eq("room-1"), eq("message-1"))).thenReturn(response);
        when(chatService.getParticipantIds("room-1")).thenReturn(List.of("user-a", "user-b"));

        controller.markSeen(new ChatSocketController.ChatSeenPayload("room-1", "message-1"), principal("user-b"));

        ArgumentCaptor<UnreadUpdateResponse> captor = ArgumentCaptor.forClass(UnreadUpdateResponse.class);
        verify(messagingTemplate).convertAndSendToUser(eq("user-a"), eq("/queue/chat/receipts"), captor.capture());
        verify(messagingTemplate).convertAndSendToUser(eq("user-b"), eq("/queue/chat/receipts"), captor.capture());
        assertThat(captor.getAllValues()).allMatch(event -> event.getRoomId().equals("room-1"));
    }

    @Test
    void typingRequiresAuthenticationAndClearEventIsBroadcastOnlyAfterServiceAuthorization() {
        TypingEventPayload payload = new TypingEventPayload();
        payload.setRoomId("room-1");
        payload.setTyping(false);
        TypingEventView clear = new TypingEventView();
        clear.setRoomId("room-1");
        clear.setUserId("user-a");
        clear.setTyping(false);
        when(chatService.buildTypingEvent("user-a", payload)).thenReturn(clear);

        controller.sendTyping(payload, principal("user-a"));

        verify(messagingTemplate).convertAndSend("/topic/typing/room-1", clear);
        assertThatThrownBy(() -> controller.sendTyping(payload, null)).isInstanceOf(IllegalArgumentException.class);
    }

    private Principal principal(String userId) {
        return () -> userId;
    }
}
