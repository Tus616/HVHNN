package com.hvhn.backend.dto;

import java.util.ArrayList;
import java.util.List;

public class ChatHistoryResponse {
    private List<ChatMessageView> messages = new ArrayList<>();
    private int page;
    private int size;
    private boolean hasMore;

    public List<ChatMessageView> getMessages() { return messages; }
    public void setMessages(List<ChatMessageView> messages) { this.messages = messages; }

    public int getPage() { return page; }
    public void setPage(int page) { this.page = page; }

    public int getSize() { return size; }
    public void setSize(int size) { this.size = size; }

    public boolean isHasMore() { return hasMore; }
    public void setHasMore(boolean hasMore) { this.hasMore = hasMore; }
}
