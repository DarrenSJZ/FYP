package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"autocomplete/models"
	"autocomplete/services"
)

// InitializeWithData handles the request to load data into the cache
func InitializeWithData(w http.ResponseWriter, r *http.Request) {
	fmt.Println("DEBUG: InitializeWithData handler hit!") // ADDED
	if r.Method != http.MethodPost {
		http.Error(w, "Only POST method is allowed", http.StatusMethodNotAllowed)
		return
	}

	var data models.AutocompleteData
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Build and cache the data structures globally (no audio_id needed)
	services.BuildAndCacheData(&data)

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Autocomplete data initialized successfully"))
}