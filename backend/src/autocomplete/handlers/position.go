package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"autocomplete/models"
	"autocomplete/services"
)

// GetPositionSuggestions handles position-based autocomplete requests
func GetPositionSuggestions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	
	// Parse query parameters
	audioID := r.URL.Query().Get("audio_id")
	if audioID == "" {
		http.Error(w, "audio_id parameter is required", http.StatusBadRequest)
		return
	}
	
	wordIndexStr := r.URL.Query().Get("word_index")
	if wordIndexStr == "" {
		http.Error(w, "word_index parameter is required", http.StatusBadRequest)
		return
	}
	
	wordIndex, err := strconv.Atoi(wordIndexStr)
	if err != nil {
		http.Error(w, "word_index must be a valid integer", http.StatusBadRequest)
		return
	}
	
	// Get position map from service
	positionMap, err := services.GetPositionMap(audioID)
	if err != nil {
		http.Error(w, "Failed to load position map: "+err.Error(), http.StatusInternalServerError)
		return
	}
	
	// Get suggestions for the specified position
	suggestions := positionMap.GetSuggestionsForPosition(wordIndex)
	
	// Build response
	response := models.PositionResponse{
		AudioID:     audioID,
		WordIndex:   wordIndex,
		Suggestions: suggestions,
		Timestamp:   time.Now(),
	}
	
	json.NewEncoder(w).Encode(response)
}