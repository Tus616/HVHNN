package com.hvhn.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
public class RequestLoggingFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(RequestLoggingFilter.class);

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        long startTime = System.nanoTime();
        String requestId = request.getHeader("X-Request-Id");
        if (requestId == null || requestId.isBlank()) {
            requestId = UUID.randomUUID().toString();
        }
        request.setAttribute("requestId", requestId);
        response.setHeader("X-Request-Id", requestId);

        logger.info(
                "Incoming request requestId={} method={} path={} query={} remoteAddr={}",
                requestId,
                request.getMethod(),
                request.getRequestURI(),
                sanitizeQuery(request.getQueryString()),
                request.getRemoteAddr()
        );

        try {
            filterChain.doFilter(request, response);
        } finally {
            long durationMs = (System.nanoTime() - startTime) / 1_000_000;
            logger.info(
                    "Completed request requestId={} method={} path={} status={} durationMs={}",
                    requestId,
                    request.getMethod(),
                    request.getRequestURI(),
                    response.getStatus(),
                    durationMs
            );
        }
    }

    private String sanitizeQuery(String queryString) {
        if (queryString == null || queryString.isBlank()) return queryString;
        return Arrays.stream(queryString.split("&"))
                .map(parameter -> {
                    int separator = parameter.indexOf('=');
                    String name = separator >= 0 ? parameter.substring(0, separator) : parameter;
                    if (isSensitiveQueryParameter(name)) {
                        return name + "=<redacted>";
                    }
                    return parameter;
                })
                .collect(Collectors.joining("&"));
    }

    private boolean isSensitiveQueryParameter(String name) {
        return name != null && (
                name.equalsIgnoreCase("token")
                        || name.equalsIgnoreCase("access_token")
                        || name.equalsIgnoreCase("authorization")
                        || name.equalsIgnoreCase("jwt")
        );
    }
}
