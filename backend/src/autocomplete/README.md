# Autocomplete Microservice Implementation Plan

## Project Structure
```
backend/src/autocomplete/
├── main.go                 # Entry point, HTTP server setup
├── handlers/
│   ├── position.go        # Position-based suggestions endpoint
│   ├── prefix.go          # Prefix completion endpoint
│   └── health.go          # Health check endpoint
├── models/
│   ├── position_map.go    # Position mapping data structure
│   ├── prefix_trie.go     # Trie implementation
│   └── types.go           # Common types and structs
├── services/
│   ├── orchestrator.go    # Integration with orchestrator API
│   ├── data_loader.go     # Load ASR results into data structures
│   └── cache.go           # Redis caching layer
├── go.mod                 # Go dependencies
├── go.sum                 # Dependency checksums
├── Dockerfile             # Container configuration
└── docker-compose.test.yml # Local testing setup
```

## Core Data Structures

### 1. Position Mapping Structure
```go
// models/position_map.go
type PositionMap struct {
    AudioClipID string
    WordIndex   map[int][]WordSuggestion  // [position] -> suggestions
}

type WordSuggestion struct {
    Text       string    `json:"text"`
    Confidence float64   `json:"confidence"`
    Source     string    `json:"source"`     // "whisper", "gemini", etc.
    Rank       int       `json:"rank"`       // 1=best, 2=second best
}

// Fast O(1) lookup by position
func (pm *PositionMap) GetSuggestionsForPosition(pos int) []WordSuggestion {
    return pm.WordIndex[pos]
}
```

### 2. Prefix Trie Structure
```go
// models/prefix_trie.go
type TrieNode struct {
    Children    map[rune]*TrieNode
    IsEndOfWord bool
    Suggestions []WordSuggestion     // Store full word data at end nodes
}

type PrefixTrie struct {
    Root        *TrieNode
    AudioClipID string
}

// Fast prefix matching O(m) where m = prefix length
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
```

## API Endpoints

### 1. Position Suggestions
```go
// handlers/position.go
// GET /suggest/position?audio_id={id}&word_index={pos}
func GetPositionSuggestions(w http.ResponseWriter, r *http.Request) {
    audioID := r.URL.Query().Get("audio_id")
    wordIndex, _ := strconv.Atoi(r.URL.Query().Get("word_index"))
    
    // Load position map from cache or orchestrator
    positionMap := services.GetPositionMap(audioID)
    suggestions := positionMap.GetSuggestionsForPosition(wordIndex)
    
    response := PositionResponse{
        AudioID:     audioID,
        WordIndex:   wordIndex,
        Suggestions: suggestions,
        Timestamp:   time.Now(),
    }
    
    json.NewEncoder(w).Encode(response)
}
```

### 2. Prefix Completion
```go
// handlers/prefix.go  
// GET /suggest/prefix?audio_id={id}&prefix={text}&max_results={n}
func GetPrefixSuggestions(w http.ResponseWriter, r *http.Request) {
    audioID := r.URL.Query().Get("audio_id")
    prefix := r.URL.Query().Get("prefix")
    maxResults, _ := strconv.Atoi(r.URL.Query().Get("max_results"))
    if maxResults == 0 { maxResults = 5 }
    
    // Load trie from cache
    trie := services.GetPrefixTrie(audioID)
    suggestions := trie.SearchPrefix(prefix)
    
    // Limit and sort by confidence
    if len(suggestions) > maxResults {
        suggestions = suggestions[:maxResults]
    }
    
    response := PrefixResponse{
        AudioID:     audioID,
        Prefix:      prefix,
        Suggestions: suggestions,
        Timestamp:   time.Now(),
    }
    
    json.NewEncoder(w).Encode(response)
}
```

## Data Loading Pipeline

### Integration with Orchestrator
```go
// services/orchestrator.go

// Option 1: Lightweight autocomplete endpoint (RECOMMENDED)
func LoadAutocompleteData(audioID string) (*AutocompleteData, error) {
    // Call new structured endpoint for autocomplete
    resp, err := http.Get(fmt.Sprintf("http://orchestrator:8000/transcribe-for-autocomplete?audio_id=%s", audioID))
    if err != nil {
        return nil, err
    }
    
    var autocompleteData AutocompleteData
    json.NewDecoder(resp.Body).Decode(&autocompleteData)
    return &autocompleteData, nil
}

// Option 2: Full analysis endpoint (RESEARCH/ANALYSIS USE)
// Commented out for autocomplete service, but available if needed
/*
func LoadFullASRAnalysis(audioID string) (*FullAnalysisResponse, error) {
    // Call existing detailed endpoint for research purposes
    resp, err := http.Get(fmt.Sprintf("http://orchestrator:8000/transcribe-with-gemini?audio_id=%s", audioID))
    if err != nil {
        return nil, err
    }
    
    var orchestratorResponse struct {
        ASRResults     map[string]interface{} `json:"asr_results"`
        GeminiAnalysis map[string]interface{} `json:"gemini_analysis"`
    }
    json.NewDecoder(resp.Body).Decode(&orchestratorResponse)
    return &orchestratorResponse, nil
}
*/

type AutocompleteData struct {
    FinalTranscription string   `json:"final_transcription"`
    ConfidenceScore   float64  `json:"confidence_score"`
    DetectedParticles []string `json:"detected_particles"`
    ASRAlternatives   map[string]string `json:"asr_alternatives"` // model -> transcription
}

// Transform orchestrator results into autocomplete data structures
func BuildDataStructures(orchestratorResponse *OrchestratorResponse) (*PositionMap, *PrefixTrie) {
    posMap := &PositionMap{
        AudioClipID: orchestratorResponse.ASRResults.AudioFilename,
        WordIndex:   make(map[int][]WordSuggestion),
    }
    
    prefixTrie := &PrefixTrie{
        Root:        &TrieNode{Children: make(map[rune]*TrieNode)},
        AudioClipID: orchestratorResponse.ASRResults.AudioFilename,
    }
    
    // STEP 1: Use Gemini's FINAL transcription as position baseline
    geminiAnalysis := orchestratorResponse.GeminiAnalysis.Response
    finalTranscription := extractFinalTranscription(geminiAnalysis) // Parse "FINAL TRANSCRIPTION: ..."
    baselineWords := strings.Fields(finalTranscription)
    
    // Initialize each position with Gemini's processed word (highest confidence)
    for i, baseWord := range baselineWords {
        suggestion := WordSuggestion{
            Text:       baseWord,
            Confidence: 0.95, // LLM processed = highest confidence
            Source:     "gemini_final",
            Rank:       1,
        }
        
        posMap.WordIndex[i] = []WordSuggestion{suggestion}
        prefixTrie.Insert(baseWord, suggestion)
    }
    
    // STEP 2: Add word-based ASR models as alternatives (exclude allosaurus)
    wordBasedModels := []string{"whisper", "mesolitica", "vosk", "wav2vec", "moonshine"}
    
    for _, modelName := range wordBasedModels {
        result := orchestratorResponse.ASRResults.Results[modelName]
        if result.Status != "success" {
            continue
        }
        
        modelWords := strings.Fields(result.Transcription)
        alignedAlternatives := alignToBaseline(baselineWords, modelWords)
        
        for pos, altWord := range alignedAlternatives {
            if pos >= len(baselineWords) {
                continue // Skip if model has extra words
            }
            
            if altWord != baselineWords[pos] { // Only add if different from baseline
                suggestion := WordSuggestion{
                    Text:       altWord,
                    Confidence: 0.7, // Raw ASR = lower confidence than Gemini
                    Source:     modelName,
                    Rank:       2,
                }
                
                posMap.WordIndex[pos] = append(posMap.WordIndex[pos], suggestion)
                prefixTrie.Insert(altWord, suggestion)
            }
        }
    }
    
    return posMap, prefixTrie
}

// Helper function to align ASR words to Gemini baseline positions
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

// Extract FINAL TRANSCRIPTION from Gemini's response text
func extractFinalTranscription(geminiText string) string {
    lines := strings.Split(geminiText, "\n")
    for _, line := range lines {
        if strings.Contains(line, "FINAL TRANSCRIPTION:") {
            parts := strings.SplitN(line, ":", 2)
            if len(parts) == 2 {
                return strings.TrimSpace(parts[1])
            }
        }
    }
    return "" // Fallback to empty if not found
}
```

## Caching Strategy

### Redis Integration
```go
// services/cache.go
func CachePositionMap(audioID string, posMap *PositionMap) error {
    data, _ := json.Marshal(posMap)
    return redisClient.Set(fmt.Sprintf("position:%s", audioID), data, time.Hour).Err()
}

func GetCachedPositionMap(audioID string) (*PositionMap, error) {
    data, err := redisClient.Get(fmt.Sprintf("position:%s", audioID)).Result()
    if err != nil {
        return nil, err
    }
    
    var posMap PositionMap
    json.Unmarshal([]byte(data), &posMap)
    return &posMap, nil
}
```

## Performance Optimizations

### 1. Precomputation
- **On audio upload:** Immediately process ASR results and build data structures
- **Cache warm-up:** Pre-load common words and patterns
- **Background updates:** Refresh cache when new user corrections are made

### 2. Memory Management
```go
// Limit trie size to prevent memory bloat
const MAX_TRIE_WORDS = 10000
const MAX_SUGGESTIONS_PER_WORD = 10

// Use sync.Pool for reusing objects
var suggestionPool = sync.Pool{
    New: func() interface{} {
        return make([]WordSuggestion, 0, MAX_SUGGESTIONS_PER_WORD)
    },
}
```

### 3. Concurrent Processing
```go
// Process multiple audio clips in parallel
func BuildDataStructuresAsync(audioIDs []string) {
    var wg sync.WaitGroup
    for _, audioID := range audioIDs {
        wg.Add(1)
        go func(id string) {
            defer wg.Done()
            asrResults, _ := LoadASRResultsFromOrchestrator(id)
            posMap, prefixTrie := BuildDataStructures(asrResults)
            CachePositionMap(id, posMap)
            CachePrefixTrie(id, prefixTrie)
        }(audioID)
    }
    wg.Wait()
}
```

## Docker Configuration

### Dockerfile
```dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o autocomplete main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/

COPY --from=builder /app/autocomplete .
EXPOSE 8007

CMD ["./autocomplete"]
```

### docker-compose.yml Integration
```yaml
autocomplete-service:
  build:
    context: backend/src/autocomplete
  ports:
    - "8007:8007"
  environment:
    - REDIS_URL=redis://redis:6379
    - ORCHESTRATOR_URL=http://orchestrator:8000
  depends_on:
    - redis
    - orchestrator
```

## API Response Formats

### Position Suggestions Response
```json
{
  "audio_id": "abc123",
  "word_index": 2,
  "suggestions": [
    {
      "text": "like",
      "confidence": 0.95,
      "source": "whisper",
      "rank": 1
    },
    {
      "text": "lying",
      "confidence": 0.78,
      "source": "moonshine", 
      "rank": 2
    }
  ],
  "timestamp": "2025-01-07T12:00:00Z"
}
```

### Prefix Completion Response
```json
{
  "audio_id": "abc123",
  "prefix": "li",
  "suggestions": [
    {
      "text": "like",
      "confidence": 0.95,
      "source": "whisper",
      "rank": 1
    },
    {
      "text": "light",
      "confidence": 0.82,
      "source": "gemini",
      "rank": 2
    }
  ],
  "timestamp": "2025-01-07T12:00:00Z"
}
```

## Testing Strategy

### Unit Tests
```go
// Test trie functionality
func TestPrefixTrie_SearchPrefix(t *testing.T) {
    trie := NewPrefixTrie("test_audio")
    trie.Insert("like", WordSuggestion{Text: "like", Confidence: 0.95})
    trie.Insert("light", WordSuggestion{Text: "light", Confidence: 0.80})
    
    results := trie.SearchPrefix("li")
    assert.Equal(t, 2, len(results))
    assert.Equal(t, "like", results[0].Text)
}
```

### Integration Tests
```go
// Test full pipeline from orchestrator to suggestions
func TestFullPipeline(t *testing.T) {
    // Mock orchestrator response
    // Test data structure building
    // Test API endpoints
    // Verify performance < 50ms
}
```

## Deployment Checklist

- [ ] Go service builds successfully
- [ ] Docker container runs and exposes port 8007
- [ ] Redis connection established
- [ ] Orchestrator integration working
- [ ] Health check endpoint responds
- [ ] Performance tests pass (<50ms response time)
- [ ] Memory usage under limits
- [ ] Error handling and logging implemented
- [ ] API documentation updated

## Next Steps

1. **Initialize Go module:** `go mod init autocomplete`
2. **Implement basic trie:** Start with prefix_trie.go
3. **Create position mapping:** Build position_map.go
4. **Set up HTTP handlers:** Basic API endpoints
5. **Add Redis caching:** Performance optimization
6. **Docker integration:** Add to existing docker-compose
7. **Frontend integration:** Connect to React/Vue components