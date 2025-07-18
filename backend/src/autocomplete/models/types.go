package models

import (
	"time"
)

// WordSuggestion represents a single autocomplete suggestion
type WordSuggestion struct {
	Text       string  `json:"text"`
	Confidence float64 `json:"confidence"`
	Source     string  `json:"source"`
	Rank       int     `json:"rank"`
}



// PrefixResponse represents the response for prefix-based completions
type PrefixResponse struct {
	AudioID     string           `json:"audio_id"`
	Prefix      string           `json:"prefix"`
	Suggestions []WordSuggestion `json:"suggestions"`
	Timestamp   time.Time        `json:"timestamp"`
}

// AutocompleteData represents the structured data from orchestrator
type AutocompleteData struct {
		FinalTranscription string            `json:"final_transcription"`
	ConfidenceScore   float64           `json:"confidence_score"`
	DetectedParticles []string          `json:"detected_particles"`
	ASRAlternatives   map[string]string `json:"asr_alternatives"`
}