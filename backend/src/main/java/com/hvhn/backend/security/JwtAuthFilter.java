package com.hvhn.backend.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hvhn.backend.dto.ApiErrorResponse;
import com.hvhn.backend.model.User;
import com.hvhn.backend.repository.UserRepository;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.security.web.util.matcher.OrRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.cors.CorsUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.Optional;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(JwtAuthFilter.class);
    private final RequestMatcher protectedRequestEndpoints = new OrRequestMatcher(
            new AntPathRequestMatcher("/api/requests/my", "GET"),
            new AntPathRequestMatcher("/api/requests/volunteered", "GET")
    );

    private final RequestMatcher publicEndpoints = new OrRequestMatcher(
            new AntPathRequestMatcher("/api/auth/**"),
            new AntPathRequestMatcher("/verifyToken"),
            new AntPathRequestMatcher("/api/health/**"),
            new AntPathRequestMatcher("/api/test/**"),
            new AntPathRequestMatcher("/api/public/**"),
            new AntPathRequestMatcher("/api/requests/public/**"),
            new AntPathRequestMatcher("/api/requests", "GET"),
            new AntPathRequestMatcher("/api/requests/*", "GET"),
            new AntPathRequestMatcher("/api/requests/open", "GET"),
            new AntPathRequestMatcher("/api/community/announcements/pinned", "GET"),
            new AntPathRequestMatcher("/api/communities", "GET"),
            new AntPathRequestMatcher("/ws/**"),
            // /uploads/** removed — chat attachments served from Cloudinary (absolute HTTPS URLs)
            new AntPathRequestMatcher("/error")
    );

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    public JwtAuthFilter(JwtUtil jwtUtil, UserRepository userRepository, ObjectMapper objectMapper) {
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Public endpoints stay unauthenticated, but every protected request must carry the app JWT.
        return CorsUtils.isPreFlightRequest(request) || (!protectedRequestEndpoints.matches(request) && publicEndpoints.matches(request));
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        Authentication existingAuthentication = SecurityContextHolder.getContext().getAuthentication();
        if (existingAuthentication != null && existingAuthentication.isAuthenticated()) {
            filterChain.doFilter(request, response);
            return;
        }

        String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (!StringUtils.hasText(authHeader) || !authHeader.startsWith("Bearer ")) {
            logger.warn("Protected request rejected because the Authorization header is missing. method={} path={}",
                    request.getMethod(), request.getRequestURI());
            writeUnauthorizedResponse(request, response, "Missing Bearer token");
            return;
        }

        String token = authHeader.substring(7).trim();
        if (!StringUtils.hasText(token)) {
            logger.warn("Protected request rejected because the Bearer token was blank. method={} path={}",
                    request.getMethod(), request.getRequestURI());
            writeUnauthorizedResponse(request, response, "Missing Bearer token");
            return;
        }

        try {
            String email = jwtUtil.getEmailFromToken(token);
            Optional<User> userOpt = userRepository.findByEmail(email);

            if (userOpt.isEmpty()) {
                logger.warn("Protected request rejected because the user was not found. email={} path={}",
                        email, request.getRequestURI());
                writeUnauthorizedResponse(request, response, "Authenticated user was not found");
                return;
            }

            User user = userOpt.get();
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                    user,
                    null,
                    Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + user.getRole()))
            );
            context.setAuthentication(authToken);
            SecurityContextHolder.setContext(context);

            logger.debug("JWT authentication succeeded for email={} path={}", email, request.getRequestURI());
            filterChain.doFilter(request, response);
        } catch (ExpiredJwtException exception) {
            logger.warn("Protected request rejected because the JWT expired. path={}", request.getRequestURI());
            writeUnauthorizedResponse(request, response, "Authentication token has expired");
        } catch (JwtException | IllegalArgumentException exception) {
            logger.warn("Protected request rejected because the JWT was invalid. path={} message={}",
                    request.getRequestURI(), exception.getMessage());
            writeUnauthorizedResponse(request, response, "Authentication token is invalid");
        }
    }

    private void writeUnauthorizedResponse(
            HttpServletRequest request,
            HttpServletResponse response,
            String message
    ) throws IOException {
        SecurityContextHolder.clearContext();
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);

        ApiErrorResponse errorResponse = new ApiErrorResponse(
                HttpStatus.UNAUTHORIZED.value(),
                HttpStatus.UNAUTHORIZED.getReasonPhrase(),
                message,
                request.getRequestURI(),
                String.valueOf(request.getAttribute("requestId"))
        );
        objectMapper.writeValue(response.getOutputStream(), errorResponse);
    }
}
