package models

import (
	"sort"
)

// PositionMap represents position-based word suggestions
type PositionMap struct {
	AudioClipID string
	WordIndex   map[int][]WordSuggestion
}

// NewPositionMap creates a new position map
func NewPositionMap(audioClipID string) *PositionMap {
	return &PositionMap{
		AudioClipID: audioClipID,
		WordIndex:   make(map[int][]WordSuggestion),
	}
}

// AddSuggestion adds a word suggestion at a specific position
func (pm *PositionMap) AddSuggestion(position int, suggestion WordSuggestion) {
	pm.WordIndex[position] = append(pm.WordIndex[position], suggestion)
	
	// Sort suggestions by confidence (descending)
	sort.Slice(pm.WordIndex[position], func(i, j int) bool {
		return pm.WordIndex[position][i].Confidence > pm.WordIndex[position][j].Confidence
	})
	
	// Limit to top 5 suggestions per position
	if len(pm.WordIndex[position]) > 5 {
		pm.WordIndex[position] = pm.WordIndex[position][:5]
	}
}

// GetSuggestionsForPosition returns all suggestions for a specific word position
func (pm *PositionMap) GetSuggestionsForPosition(pos int) []WordSuggestion {
	if suggestions, exists := pm.WordIndex[pos]; exists {
		return suggestions
	}
	return []WordSuggestion{}
}

// GetPositionCount returns the number of word positions available
func (pm *PositionMap) GetPositionCount() int {
	maxPos := -1
	for pos := range pm.WordIndex {
		if pos > maxPos {
			maxPos = pos
		}
	}
	return maxPos + 1
}

// GetAllPositions returns all available word positions
func (pm *PositionMap) GetAllPositions() []int {
	positions := make([]int, 0, len(pm.WordIndex))
	for pos := range pm.WordIndex {
		positions = append(positions, pos)
	}
	sort.Ints(positions)
	return positions
}