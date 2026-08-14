package com.hvhn.backend.config;

import com.hvhn.backend.security.JwtHandshakeHandler;
import com.hvhn.backend.security.JwtHandshakeInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.Arrays;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtHandshakeInterceptor jwtHandshakeInterceptor;
    private final String allowedOriginsProperty;
    private final boolean productionProfile;

    public WebSocketConfig(
            JwtHandshakeInterceptor jwtHandshakeInterceptor,
            @Value("${app.cors.allowed-origins}")
            String allowedOriginsProperty,
            Environment environment
    ) {
        this.jwtHandshakeInterceptor = jwtHandshakeInterceptor;
        this.allowedOriginsProperty = allowedOriginsProperty;
        this.productionProfile = Arrays.stream(environment.getActiveProfiles())
                .anyMatch(profile -> profile.equalsIgnoreCase("prod") || profile.equalsIgnoreCase("production"));
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(parseConfiguredOrigins())
                .addInterceptors(jwtHandshakeInterceptor)
                .setHandshakeHandler(new JwtHandshakeHandler())
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    private String[] parseConfiguredOrigins() {
        return CorsOriginParser.parse(allowedOriginsProperty, productionProfile).toArray(String[]::new);
    }
}
