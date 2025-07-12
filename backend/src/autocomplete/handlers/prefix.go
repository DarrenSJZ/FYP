package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"autocomplete/models"
	"autocomplete/services"
)

// GetPrefixSuggestions handles prefix-based autocomplete requests
func GetPrefixSuggestions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	
	// Parse query parameters
	audioID := r.URL.Query().Get("audio_id")
	if audioID == "" {
		http.Error(w, "audio_id parameter is required", http.StatusBadRequest)
		return
	}
	
	prefix := r.URL.Query().Get("prefix")
	if prefix == "" {
		http.Error(w, "prefix parameter is required", http.StatusBadRequest)
		return
	}
	
	maxResultsStr := r.URL.Query().Get("max_results")
	maxResults := 5 // default
	if maxResultsStr != "" {
		if parsed, err := strconv.Atoi(maxResultsStr); err == nil && parsed > 0 {
			maxResults = parsed
		}
	}
	
	// Get prefix trie from service
	trie, err := services.GetPrefixTrie(audioID)
	if err != nil {
		http.Error(w, "Failed to load prefix trie: "+err.Error(), http.StatusInternalServerError)
		return
	}
	
	// Search for suggestions
	suggestions := trie.SearchPrefix(prefix)
	
	// Limit results
	if len(suggestions) > maxResults {
		suggestions = suggestions[:maxResults]
	}
	
	// Build response
	response := models.PrefixResponse{
		AudioID:     audioID,
		Prefix:      prefix,
		Suggestions: suggestions,
		Timestamp:   time.Now(),
	}
	
	json.NewEncoder(w).Encode(response)
}