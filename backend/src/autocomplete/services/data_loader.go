package services

import (
	"fmt"
	"sync"

	"autocomplete/models"
)

// In-memory cache for single global trie (replace with Redis in production)
var (
	globalPrefixTrie *models.PrefixTrie
	cacheMutex       sync.RWMutex
)

// BuildAndCacheData builds the PrefixTrie from the provided data and caches it globally.
// This is called by the /initialize endpoint.
func BuildAndCacheData(data *models.AutocompleteData) {
	fmt.Println("DEBUG: BuildAndCacheData called") // ADDED
	// Build the data structure
	trie := BuildDataStructures(data)

	// Cache the result globally
	cacheMutex.Lock()
	globalPrefixTrie = trie
	cacheMutex.Unlock()
	fmt.Println("DEBUG: Global PrefixTrie cached") // ADDED
}

// GetPrefixTrie retrieves the global prefix trie from the cache.
// This is called by the /suggest/prefix endpoint.
func GetPrefixTrie() (*models.PrefixTrie, error) {
	fmt.Println("DEBUG: GetPrefixTrie called") // ADDED
	cacheMutex.RLock()
	defer cacheMutex.RUnlock()

	if globalPrefixTrie != nil {
		fmt.Println("DEBUG: Global PrefixTrie found in cache") // ADDED
		return globalPrefixTrie, nil
	}

	fmt.Println("DEBUG: Global PrefixTrie NOT found in cache") // ADDED
	return nil, fmt.Errorf("autocomplete not initialized, please initialize first")
}

// ClearCache clears all cached data (useful for testing)
func ClearCache() {
	cacheMutex.Lock()
	defer cacheMutex.Unlock()

	globalPrefixTrie = nil
}