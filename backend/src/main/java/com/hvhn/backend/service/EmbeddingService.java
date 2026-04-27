package com.hvhn.backend.service;

import com.hvhn.backend.model.HelpRequest;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class EmbeddingService {

    private final GeminiService geminiService;

    public EmbeddingService(GeminiService geminiService) {
        this.geminiService = geminiService;
    }

    /**
     * Generate an embedding for a help request.
     * Combines title, description, and category for a rich representation.
     */
    public List<Double> generateEmbeddingForRequest(HelpRequest request) {
        String textToEmbed = String.format("Title: %s. Description: %s. Category: %s.",
                request.getTitle(),
                request.getDescription(),
                request.getCategory());
        return geminiService.generateEmbedding(textToEmbed);
    }

    /**
     * Generate an embedding for a search query.
     */
    public List<Double> generateEmbeddingForQuery(String query) {
        return geminiService.generateEmbedding(query);
    }

    /**
     * Calculate cosine similarity between two vectors.
     */
    public double calculateCosineSimilarity(List<Double> vectorA, List<Double> vectorB) {
        if (vectorA == null || vectorB == null || vectorA.size() != vectorB.size()) {
            return 0.0;
        }

        double dotProduct = 0.0;
        double normA = 0.0;
        double normB = 0.0;

        for (int i = 0; i < vectorA.size(); i++) {
            dotProduct += vectorA.get(i) * vectorB.get(i);
            normA += Math.pow(vectorA.get(i), 2);
            normB += Math.pow(vectorB.get(i), 2);
        }

        if (normA == 0 || normB == 0) return 0.0;
        
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
