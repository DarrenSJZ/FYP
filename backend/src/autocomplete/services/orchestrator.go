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
	AutocompleteData *models.AutocompleteData `json:"autocomplete_data"`
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
	
	url := fmt.Sprintf("%s/transcribe-consensus", orchestratorURL)
	
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
	
	// Use the pre-extracted autocomplete data if available
	if orchestratorResp.AutocompleteData != nil {
		return orchestratorResp.AutocompleteData, nil
	}
	
	// Fallback to manual extraction (for backward compatibility)
	autocompleteData := &models.AutocompleteData{
		FinalTranscription: orchestratorResp.Primary,
		ConfidenceScore:   orchestratorResp.Metadata.Confidence,
		DetectedParticles: []string{}, // TODO: Extract from PotentialParticles
		ASRAlternatives:   orchestratorResp.Alternatives,
	}
	
	return autocompleteData, nil
}

// BuildDataStructures transforms orchestrator results into autocomplete data structures
func BuildDataStructures(autocompleteData *models.AutocompleteData) *models.PrefixTrie {
	fmt.Println("DEBUG: BuildDataStructures called") // ADDED
	fmt.Println("DEBUG: FinalTranscription received:", autocompleteData.FinalTranscription) // ADDED

	prefixTrie := models.NewPrefixTrie("global")

	// STEP 1: Use final transcription as baseline
	baselineWords := strings.Fields(autocompleteData.FinalTranscription)
	fmt.Println("DEBUG: Baseline words:", baselineWords) // ADDED

	for _, baseWord := range baselineWords {
		suggestion := models.WordSuggestion{
			Text:       baseWord,
			Confidence: autocompleteData.ConfidenceScore,
			Source:     "gemini_final",
			Rank:       1,
		}

		prefixTrie.Insert(baseWord, suggestion)
		fmt.Println("DEBUG: Inserted word:", baseWord) // ADDED
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

					prefixTrie.Insert(altWord, suggestion)
				}
			}
		}
	}

	return prefixTrie
}


func alignToBaseline(baseline []string, modelWords []string) map[int]string {
	aligned := make(map[int]string)


	minLen := len(baseline)
	if len(modelWords) < minLen {
		minLen = len(modelWords)
	}

	for i := 0; i < minLen; i++ {
		aligned[i] = modelWords[i]
	}

	return aligned
}