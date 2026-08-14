package com.hvhn.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * MVC configuration.
 *
 * <p>The local-filesystem upload resource handler has been removed.
 * Chat file uploads are now served from Cloudinary (absolute HTTPS URLs)
 * and do not require any static resource mapping in this application.
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {
    // No local upload resource handler needed — files are stored on Cloudinary.
}
