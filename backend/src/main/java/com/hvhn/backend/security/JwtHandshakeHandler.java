package com.hvhn.backend.security;

import org.springframework.http.server.ServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

import java.security.Principal;
import java.util.Map;

public class JwtHandshakeHandler extends DefaultHandshakeHandler {

    @Override
    protected Principal determineUser(
            ServerHttpRequest request,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes
    ) {
        Object principal = attributes.get(JwtHandshakeInterceptor.CHAT_PRINCIPAL_ATTRIBUTE);
        if (principal instanceof Principal resolvedPrincipal) {
            return resolvedPrincipal;
        }
        return super.determineUser(request, wsHandler, attributes);
    }
}
