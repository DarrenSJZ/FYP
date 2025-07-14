package main

import (
	"log"
	"net/http"
	"os"

	"autocomplete/handlers"
)

// CORS middleware to allow frontend connections
func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Allow all origins for development (you might want to restrict this in production)
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		// Handle preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {
	log.Printf("DEBUG: Starting main function")
	
	// Set up routes with CORS middleware
	log.Printf("DEBUG: Setting up routes with CORS middleware")
	http.HandleFunc("/health", corsMiddleware(handlers.HealthCheck))
	http.HandleFunc("/suggest/position", corsMiddleware(handlers.GetPositionSuggestions))
	http.HandleFunc("/suggest/prefix", corsMiddleware(handlers.GetPrefixSuggestions))
	
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