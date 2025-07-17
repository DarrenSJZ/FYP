package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"autocomplete/services"
)

// GetPrefixSuggestions handles requests for prefix-based autocomplete suggestions.
func GetPrefixSuggestions(w http.ResponseWriter, r *http.Request) {
	// Extract prefix from query parameters (no audio_id needed)
	prefix := r.URL.Query().Get("prefix")
	maxResults := 10 // Default max results

	fmt.Println("DEBUG: GetPrefixSuggestions called for prefix:", prefix) // ADDED

	if prefix == "" {
		http.Error(w, "Missing prefix parameter", http.StatusBadRequest)
		return
	}

	// Retrieve the global prefix trie
	trie, err := services.GetPrefixTrie()
	if err != nil {
		fmt.Println("ERROR: GetPrefixTrie failed:", err) // ADDED
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	// Get suggestions from the trie
	suggestions := trie.Search(prefix, maxResults)
	fmt.Println("DEBUG: Suggestions found for prefix '" + prefix + "':", suggestions) // ADDED

	// Prepare response
	response := map[string][]string{"suggestions": suggestions}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}