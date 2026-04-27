package com.hvhn.backend.controller;

import com.hvhn.backend.dto.ChatHistoryResponse;
import com.hvhn.backend.dto.ChatMessageView;
import com.hvhn.backend.dto.ChatRoomView;
import com.hvhn.backend.dto.DirectChatRoomRequest;
import com.hvhn.backend.dto.FileUploadResponse;
import com.hvhn.backend.dto.GroupChatRoomRequest;
import com.hvhn.backend.dto.UnreadUpdateResponse;
import com.hvhn.backend.model.User;
import com.hvhn.backend.service.ChatService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @GetMapping("/{roomId}/history")
    public ResponseEntity<ChatHistoryResponse> getRoomHistory(
            @AuthenticationPrincipal User currentUser,
            @PathVariable String roomId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        return ResponseEntity.ok(chatService.getHistory(currentUser, roomId, page, size));
    }

    @GetMapping("/rooms")
    public ResponseEntity<List<ChatRoomView>> getRooms(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(chatService.getRooms(currentUser));
    }

    @PostMapping("/rooms/direct")
    public ResponseEntity<ChatRoomView> createDirectRoom(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody DirectChatRoomRequest request
    ) {
        return ResponseEntity.ok(chatService.createOrGetDirectRoom(currentUser, request));
    }

    @PostMapping("/rooms/group")
    public ResponseEntity<ChatRoomView> createGroupRoom(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody GroupChatRoomRequest request
    ) {
        return ResponseEntity.ok(chatService.createGroupRoom(currentUser, request));
    }

    @PutMapping("/{messageId}/read")
    public ResponseEntity<UnreadUpdateResponse> markRead(
            @AuthenticationPrincipal User currentUser,
            @PathVariable String messageId
    ) {
        return ResponseEntity.ok(chatService.markRead(currentUser, messageId));
    }

    @PostMapping("/{messageId}/react")
    public ResponseEntity<ChatMessageView> toggleReaction(
            @AuthenticationPrincipal User currentUser,
            @PathVariable String messageId,
            @RequestParam String emoji
    ) {
        return ResponseEntity.ok(chatService.toggleReaction(currentUser, messageId, emoji));
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<FileUploadResponse> uploadAttachment(@RequestPart("file") MultipartFile file) {
        return ResponseEntity.ok(chatService.uploadAttachment(file));
    }

    @DeleteMapping("/messages/{messageId}")
    public ResponseEntity<Void> deleteMessage(
            @AuthenticationPrincipal User currentUser,
            @PathVariable String messageId
    ) {
        chatService.deleteMessage(currentUser, messageId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/rooms/{roomId}")
    public ResponseEntity<Void> deleteRoom(
            @AuthenticationPrincipal User currentUser,
            @PathVariable String roomId
    ) {
        chatService.deleteRoom(currentUser, roomId);
        return ResponseEntity.noContent().build();
    }
}
