package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

type AutocompleteService struct {
	RedisClient *redis.Client
}

func main() {
	// Initialize Redis connection
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://redis:6379"
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("Failed to parse Redis URL: %v", err)
	}

	redisClient := redis.NewClient(opt)
	
	// Test Redis connection
	ctx := context.Background()
	_, err = redisClient.Ping(ctx).Result()
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	log.Println("Successfully connected to Redis")

	service := &AutocompleteService{
		RedisClient: redisClient,
	}

	// Setup Gin router
	router := gin.Default()
	
	// Add CORS middleware
	router.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// Register routes
	router.GET("/health", service.handleHealth)
	router.POST("/initialize", service.handleInitialize)
	router.GET("/suggest/prefix", service.handlePrefixSuggest)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8007"
	}

	log.Printf("Starting autocomplete service on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func (s *AutocompleteService) handleHealth(c *gin.Context) {
	// Check Redis connection
	ctx := context.Background()
	_, err := s.RedisClient.Ping(ctx).Result()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status": "unhealthy",
			"error": "Redis connection failed",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "healthy",
		"redis": "connected",
	})
}

func (s *AutocompleteService) handleInitialize(c *gin.Context) {
	var request struct {
		FinalTranscription string            `json:"final_transcription"`
		ConfidenceScore   float64           `json:"confidence_score"`
		DetectedParticles []string          `json:"detected_particles"`
		AsrAlternatives   map[string]string `json:"asr_alternatives"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	
	// Store final transcription with confidence
	if request.FinalTranscription != "" {
		err := s.storeTranscriptionWords(ctx, request.FinalTranscription, request.ConfidenceScore)
		if err != nil {
			log.Printf("Error storing transcription: %v", err)
		}
	}

	// Store ASR alternatives
	for model, transcription := range request.AsrAlternatives {
		if transcription != "" {
			err := s.storeTranscriptionWords(ctx, transcription, 0.8) // Lower confidence for alternatives
			if err != nil {
				log.Printf("Error storing %s alternative: %v", model, err)
			}
		}
	}

	// Store detected particles
	for _, particle := range request.DetectedParticles {
		err := s.storeWord(ctx, particle, 0.9)
		if err != nil {
			log.Printf("Error storing particle %s: %v", particle, err)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"message": "Autocomplete data initialized",
	})
}

func (s *AutocompleteService) handlePrefixSuggest(c *gin.Context) {
	prefix := c.Query("prefix")
	if prefix == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "prefix parameter required"})
		return
	}

	maxResults := 5
	if maxParam := c.Query("max_results"); maxParam != "" {
		// Parse maxResults if provided
	}

	ctx := context.Background()
	suggestions, err := s.getPrefixSuggestions(ctx, prefix, maxResults)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"suggestions": suggestions,
		"prefix": prefix,
	})
}

func (s *AutocompleteService) storeTranscriptionWords(ctx context.Context, transcription string, baseConfidence float64) error {
	words := splitIntoWords(transcription)
	
	for i, word := range words {
		if word == "" {
			continue
		}
		
		// Store word with confidence
		confidence := baseConfidence
		if i == 0 {
			confidence += 0.1 // Boost first word confidence
		}
		
		err := s.storeWord(ctx, word, confidence)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *AutocompleteService) storeWord(ctx context.Context, word string, confidence float64) error {
	// Store in global word frequency
	s.RedisClient.ZIncrBy(ctx, "autocomplete:global:frequency", 1, word)
	
	// Store for prefix matching - add to all relevant prefix keys
	for i := 1; i <= len(word) && i <= 10; i++ {
		prefix := word[:i]
		key := "autocomplete:prefix:" + prefix
		s.RedisClient.ZAdd(ctx, key, &redis.Z{
			Score:  confidence,
			Member: word,
		})
		// Set expiration to 1 hour for prefix keys
		s.RedisClient.Expire(ctx, key, time.Hour)
	}
	
	return nil
}

func (s *AutocompleteService) getPrefixSuggestions(ctx context.Context, prefix string, maxResults int) ([]map[string]interface{}, error) {
	key := "autocomplete:prefix:" + prefix
	
	// Get top suggestions from Redis sorted set
	results, err := s.RedisClient.ZRevRangeWithScores(ctx, key, 0, int64(maxResults-1)).Result()
	if err != nil {
		return nil, err
	}
	
	suggestions := make([]map[string]interface{}, len(results))
	for i, result := range results {
		suggestions[i] = map[string]interface{}{
			"text":       result.Member.(string),
			"confidence": result.Score,
		}
	}
	
	return suggestions, nil
}

func splitIntoWords(text string) []string {
	// Simple word splitting - can be enhanced with better tokenization
	words := []string{}
	current := ""
	
	for _, char := range text {
		if char == ' ' || char == '\t' || char == '\n' {
			if current != "" {
				words = append(words, current)
				current = ""
			}
		} else {
			current += string(char)
		}
	}
	
	if current != "" {
		words = append(words, current)
	}
	
	return words
}