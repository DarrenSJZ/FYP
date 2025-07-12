package models

import (
	"sort"
)

// TrieNode represents a single node in the prefix trie
type TrieNode struct {
	Children    map[rune]*TrieNode
	IsEndOfWord bool
	Suggestions []WordSuggestion
}

// PrefixTrie represents the complete trie structure
type PrefixTrie struct {
	Root        *TrieNode
	AudioClipID string
}

// NewPrefixTrie creates a new prefix trie
func NewPrefixTrie(audioClipID string) *PrefixTrie {
	return &PrefixTrie{
		Root: &TrieNode{
			Children: make(map[rune]*TrieNode),
		},
		AudioClipID: audioClipID,
	}
}

// Insert adds a word and its suggestion to the trie
func (pt *PrefixTrie) Insert(word string, suggestion WordSuggestion) {
	node := pt.Root
	for _, char := range word {
		if node.Children[char] == nil {
			node.Children[char] = &TrieNode{
				Children: make(map[rune]*TrieNode),
			}
		}
		node = node.Children[char]
	}
	node.IsEndOfWord = true
	node.Suggestions = append(node.Suggestions, suggestion)
	
	// Sort suggestions by confidence (descending)
	sort.Slice(node.Suggestions, func(i, j int) bool {
		return node.Suggestions[i].Confidence > node.Suggestions[j].Confidence
	})
}

// SearchPrefix finds all words that start with the given prefix
func (pt *PrefixTrie) SearchPrefix(prefix string) []WordSuggestion {
	node := pt.Root
	for _, char := range prefix {
		if node.Children[char] == nil {
			return []WordSuggestion{}
		}
		node = node.Children[char]
	}
	return pt.collectAllSuggestions(node)
}

// collectAllSuggestions recursively collects all suggestions from a node
func (pt *PrefixTrie) collectAllSuggestions(node *TrieNode) []WordSuggestion {
	var suggestions []WordSuggestion
	
	if node.IsEndOfWord {
		suggestions = append(suggestions, node.Suggestions...)
	}
	
	for _, child := range node.Children {
		suggestions = append(suggestions, pt.collectAllSuggestions(child)...)
	}
	
	// Sort by confidence and limit results
	sort.Slice(suggestions, func(i, j int) bool {
		return suggestions[i].Confidence > suggestions[j].Confidence
	})
	
	// Limit to top 10 suggestions to prevent overwhelming responses
	if len(suggestions) > 10 {
		suggestions = suggestions[:10]
	}
	
	return suggestions
}