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

// Search finds all words that start with the given prefix and returns their text.
func (pt *PrefixTrie) Search(prefix string, maxResults int) []string {
	node := pt.Root
	for _, char := range prefix {
		if node.Children[char] == nil {
			return []string{}
		}
		node = node.Children[char]
	}
	
	// Collect all WordSuggestions from the subtree
	allSuggestions := pt.collectAllSuggestions(node)
	
	// Extract only the text and limit results
	var result []string
	for i, s := range allSuggestions {
		if i >= maxResults {
			break
		}
		result = append(result, s.Text)
	}
	
	return result
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
	
	// Sort by confidence (descending)
	sort.Slice(suggestions, func(i, j int) bool {
		return suggestions[i].Confidence > suggestions[j].Confidence
	})
	
	return suggestions
}