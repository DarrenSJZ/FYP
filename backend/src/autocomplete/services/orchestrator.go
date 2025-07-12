package services

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"autocomplete/models"
)

// OrchestratorResponse represents the response from the orchestrator API
type OrchestratorResponse struct {
	Status    string `json:"status"`
	Primary   string `json:"primary"`
	Alternatives map[string]string `json:"alternatives"`
	PotentialParticles []interface{} `json:"potential_particles"`
	Metadata struct {
		Confidence     float64 `json:"confidence"`
		ProcessingTime float64 `json:"processing_time"`
		ModelsUsed     int     `json:"models_used"`
	} `json:"metadata"`
}

// LoadAutocompleteData fetches ASR results from the orchestrator
func LoadAutocompleteData(audioID string) (*models.AutocompleteData, error) {
	orchestratorURL := os.Getenv("ORCHESTRATOR_URL")
	if orchestratorURL == "" {
		orchestratorURL = "http://localhost:8000"
	}
	
	url := fmt.Sprintf("%s/transcribe-with-gemini", orchestratorURL)
	
	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to call orchestrator: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("orchestrator returned status %d", resp.StatusCode)
	}
	
	var orchestratorResp OrchestratorResponse
	if err := json.NewDecoder(resp.Body).Decode(&orchestratorResp); err != nil {
		return nil, fmt.Errorf("failed to decode orchestrator response: %w", err)
	}
	
	// Convert to AutocompleteData format
	autocompleteData := &models.AutocompleteData{
		FinalTranscription: orchestratorResp.Primary,
		ConfidenceScore:   orchestratorResp.Metadata.Confidence,
		DetectedParticles: []string{}, // TODO: Extract from PotentialParticles
		ASRAlternatives:   orchestratorResp.Alternatives,
	}
	
	return autocompleteData, nil
}

// BuildDataStructures transforms orchestrator results into autocomplete data structures
func BuildDataStructures(audioID string, autocompleteData *models.AutocompleteData) (*models.PositionMap, *models.PrefixTrie) {
	posMap := models.NewPositionMap(audioID)
	prefixTrie := models.NewPrefixTrie(audioID)
	
	// STEP 1: Use final transcription as baseline
	baselineWords := strings.Fields(autocompleteData.FinalTranscription)
	
	// Initialize each position with the processed word (highest confidence)
	for i, baseWord := range baselineWords {
		suggestion := models.WordSuggestion{
			Text:       baseWord,
			Confidence: autocompleteData.ConfidenceScore,
			Source:     "gemini_final",
			Rank:       1,
		}
		
		posMap.AddSuggestion(i, suggestion)
		prefixTrie.Insert(baseWord, suggestion)
	}
	
	// STEP 2: Add ASR alternatives
	wordBasedModels := []string{"whisper", "mesolitica", "vosk", "wav2vec", "moonshine"}
	
	for _, modelName := range wordBasedModels {
		if transcription, exists := autocompleteData.ASRAlternatives[modelName]; exists {
			modelWords := strings.Fields(transcription)
			alignedAlternatives := alignToBaseline(baselineWords, modelWords)
			
			for pos, altWord := range alignedAlternatives {
				if pos >= len(baselineWords) {
					continue // Skip if model has extra words
				}
				
				if altWord != baselineWords[pos] { // Only add if different from baseline
					suggestion := models.WordSuggestion{
						Text:       altWord,
						Confidence: 0.7, // Raw ASR = lower confidence
						Source:     modelName,
						Rank:       2,
					}
					
					posMap.AddSuggestion(pos, suggestion)
					prefixTrie.Insert(altWord, suggestion)
				}
			}
		}
	}
	
	return posMap, prefixTrie
}

// alignToBaseline aligns ASR words to baseline positions
func alignToBaseline(baseline []string, modelWords []string) map[int]string {
	aligned := make(map[int]string)
	
	// Simple alignment strategy: best-effort position matching
	minLen := len(baseline)
	if len(modelWords) < minLen {
		minLen = len(modelWords)
	}
	
	for i := 0; i < minLen; i++ {
		aligned[i] = modelWords[i]
	}
	
	return aligned
}