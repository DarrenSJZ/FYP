package services

import (
	"fmt"
	"sync"

	"autocomplete/models"
)

// In-memory cache for demonstration (replace with Redis in production)
var (
	positionMapCache = make(map[string]*models.PositionMap)
	prefixTrieCache  = make(map[string]*models.PrefixTrie)
	cacheMutex       sync.RWMutex
)

// GetPositionMap retrieves or builds position map for audio ID
func GetPositionMap(audioID string) (*models.PositionMap, error) {
	cacheMutex.RLock()
	if posMap, exists := positionMapCache[audioID]; exists {
		cacheMutex.RUnlock()
		return posMap, nil
	}
	cacheMutex.RUnlock()
	
	// Load fresh data from orchestrator
	return buildAndCacheData(audioID)
}

// GetPrefixTrie retrieves or builds prefix trie for audio ID
func GetPrefixTrie(audioID string) (*models.PrefixTrie, error) {
	cacheMutex.RLock()
	if trie, exists := prefixTrieCache[audioID]; exists {
		cacheMutex.RUnlock()
		return trie, nil
	}
	cacheMutex.RUnlock()
	
	// Load fresh data from orchestrator
	_, trie, err := buildAndCacheDataWithTrie(audioID)
	return trie, err
}

// buildAndCacheData builds data structures and caches them
func buildAndCacheData(audioID string) (*models.PositionMap, error) {
	// Load data from orchestrator
	autocompleteData, err := LoadAutocompleteData(audioID)
	if err != nil {
		return nil, fmt.Errorf("failed to load autocomplete data: %w", err)
	}
	
	// Build data structures
	posMap, trie := BuildDataStructures(audioID, autocompleteData)
	
	// Cache the results
	cacheMutex.Lock()
	positionMapCache[audioID] = posMap
	prefixTrieCache[audioID] = trie
	cacheMutex.Unlock()
	
	return posMap, nil
}

// buildAndCacheDataWithTrie builds data structures and returns both
func buildAndCacheDataWithTrie(audioID string) (*models.PositionMap, *models.PrefixTrie, error) {
	// Load data from orchestrator
	autocompleteData, err := LoadAutocompleteData(audioID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to load autocomplete data: %w", err)
	}
	
	// Build data structures
	posMap, trie := BuildDataStructures(audioID, autocompleteData)
	
	// Cache the results
	cacheMutex.Lock()
	positionMapCache[audioID] = posMap
	prefixTrieCache[audioID] = trie
	cacheMutex.Unlock()
	
	return posMap, trie, nil
}

// ClearCache clears all cached data (useful for testing)
func ClearCache() {
	cacheMutex.Lock()
	defer cacheMutex.Unlock()
	
	positionMapCache = make(map[string]*models.PositionMap)
	prefixTrieCache = make(map[string]*models.PrefixTrie)
}