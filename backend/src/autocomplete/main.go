package main

import (
	"log"
	"net/http"
	"os"

	"autocomplete/handlers"
)

func main() {
	log.Printf("DEBUG: Starting main function")
	
	// Set up routes
	log.Printf("DEBUG: Setting up routes")
	http.HandleFunc("/health", handlers.HealthCheck)
	http.HandleFunc("/suggest/position", handlers.GetPositionSuggestions)
	http.HandleFunc("/suggest/prefix", handlers.GetPrefixSuggestions)
	
	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "8007"
	}
	log.Printf("DEBUG: Using port %s", port)
	
	log.Printf("Starting autocomplete service on port %s", port)
	log.Printf("Available endpoints:")
	log.Printf("  GET /health - Health check")
	log.Printf("  GET /suggest/position?audio_id={id}&word_index={pos} - Position suggestions")
	log.Printf("  GET /suggest/prefix?audio_id={id}&prefix={text}&max_results={n} - Prefix completion")
	
	log.Printf("DEBUG: About to start ListenAndServe")
	// Start server on all interfaces
	if err := http.ListenAndServe("0.0.0.0:"+port, nil); err != nil {
		log.Fatal("Failed to start server:", err)
	}
	log.Printf("DEBUG: Server stopped")
}