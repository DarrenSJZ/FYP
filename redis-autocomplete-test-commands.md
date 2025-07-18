# Redis-Based Autocomplete Service - Testing Documentation for Report

## Test Environment Setup
```bash
# Ensure all services are running
docker-compose up -d

# Check service status
docker ps
```

## 1. Service Health Verification

### Test Orchestrator Service
```bash
curl http://localhost:8000/health
```
**Expected Output:**
```json
{"status":"healthy","healthy_services":6,"total_services":6,"services":{"allosaurus":true,"mesolitica":true,"moonshine":true,"vosk":true,"wav2vec":true,"whisper":true}}
```

### Test Autocomplete Service with Redis Integration
```bash
curl http://localhost:8007/health
```
**Expected Output:**
```json
{"status":"healthy","redis":"connected"}
```

### Test Redis Direct Connection
```bash
docker exec $(docker ps -q --filter "ancestor=redis:7-alpine") redis-cli ping
```
**Expected Output:**
```
PONG
```

## 2. Autocomplete Data Initialization

### Initialize Autocomplete with Sample Transcription Data
```bash
curl -X POST http://localhost:8000/initialize-autocomplete \
  -H "Content-Type: application/json" \
  -d '{
    "final_transcription": "hello world test be being beautiful",
    "confidence_score": 0.95,
    "detected_particles": ["like"],
    "asr_alternatives": {
      "whisper": "hello world this is a test",
      "wav2vec": "hello world this was a test"
    }
  }'
```
**Expected Output:**
```json
{"status":"success","message":"Autocomplete service initialized","data":{"final_transcription":"hello world test be being beautiful","confidence_score":0.95,"detected_particles":["like"],"asr_alternatives":{"whisper":"hello world this is a test","wav2vec":"hello world this was a test"}}}
```

## 3. Autocomplete Suggestion Testing

### Test Prefix-Based Suggestions
```bash
# Test 'be' prefix (should return: be, being, beautiful)
curl "http://localhost:8007/suggest/prefix?prefix=be"
```
**Expected Output:**
```json
{"prefix":"be","suggestions":[{"confidence":0.95,"text":"being"},{"confidence":0.95,"text":"beautiful"},{"confidence":0.95,"text":"be"}]}
```

### Test 'h' prefix (should return: hello)
```bash
curl "http://localhost:8007/suggest/prefix?prefix=h"
```
**Expected Output:**
```json
{"prefix":"h","suggestions":[{"confidence":1.05,"text":"hello"}]}
```

### Test 'w' prefix (should return: world, was)
```bash
curl "http://localhost:8007/suggest/prefix?prefix=w"
```
**Expected Output:**
```json
{"prefix":"w","suggestions":[{"confidence":0.95,"text":"world"},{"confidence":0.8,"text":"was"}]}
```

### Test 't' prefix (should return multiple words)
```bash
curl "http://localhost:8007/suggest/prefix?prefix=t"
```
**Expected Output:**
```json
{"prefix":"t","suggestions":[{"confidence":0.95,"text":"test"},{"confidence":0.8,"text":"this"}]}
```

## 4. Redis Data Storage Verification

### Check Stored Data in Redis
```bash
# View all autocomplete keys
docker exec $(docker ps -q --filter "ancestor=redis:7-alpine") redis-cli KEYS "autocomplete:*"
```
**Expected Output:**
```
1) "autocomplete:global:frequency"
2) "autocomplete:prefix:h"
3) "autocomplete:prefix:he"
4) "autocomplete:prefix:hel"
5) "autocomplete:prefix:hell"
6) "autocomplete:prefix:hello"
... (more prefix keys)
```

### Check Global Word Frequency Data
```bash
docker exec $(docker ps -q --filter "ancestor=redis:7-alpine") redis-cli ZRANGE autocomplete:global:frequency 0 -1 WITHSCORES
```
**Expected Output:**
```
 1) "be"
 2) "1"
 3) "being"
 4) "1"
 5) "beautiful"
 6) "1"
 7) "test"
 8) "1"
 9) "world"
 10) "1"
 11) "hello"
 12) "2"
... (showing word frequencies)
```

### Check Specific Prefix Data
```bash
docker exec $(docker ps -q --filter "ancestor=redis:7-alpine") redis-cli ZRANGE autocomplete:prefix:be 0 -1 WITHSCORES
```
**Expected Output:**
```
1) "be"
2) "0.95"
3) "being"
4) "0.95"
5) "beautiful"
6) "0.95"
```

## 5. Frontend Integration Verification

### Real-Time Autocomplete in Text Editor
1. **Navigate to frontend:** `http://localhost:5173`
2. **Open text editor** (after any transcription process)
3. **Type "be"** in the editor
4. **Observe autocomplete dropdown** showing:
   - be (confidence: 0.95)
   - being (confidence: 0.95)
   - beautiful (confidence: 0.95)

### Frontend Console Logs (Developer Tools)
```javascript
// Expected console output when typing "be":
handleChange triggered. Current value: be
Current word: be
Fetching suggestions from: http://localhost:8007/suggest/prefix?prefix=be
Fetch response status: 200
Received suggestions data: {prefix: "be", suggestions: [...]}
```

## 6. Performance and Scalability Testing

### Response Time Testing
```bash
# Measure autocomplete response time
time curl "http://localhost:8007/suggest/prefix?prefix=be"
```
**Expected:** Response time < 50ms

### Concurrent Request Testing
```bash
# Test multiple concurrent requests
for i in {1..10}; do
  curl "http://localhost:8007/suggest/prefix?prefix=be" &
done
wait
```
**Expected:** All requests return successfully with consistent data

## 7. Error Handling and Edge Cases

### Test Empty Prefix
```bash
curl "http://localhost:8007/suggest/prefix?prefix="
```
**Expected Output:**
```json
{"error":"prefix parameter required"}
```

### Test Non-existent Prefix
```bash
curl "http://localhost:8007/suggest/prefix?prefix=xyz"
```
**Expected Output:**
```json
{"prefix":"xyz","suggestions":[]}
```

## 8. System Integration Flow

### Complete Transcription-to-Autocomplete Flow
1. **Upload audio file** via frontend
2. **Process through consensus pipeline:** `/transcribe-consensus`
3. **User chooses "No, needs correction"** 
4. **System calls:** `/initialize-autocomplete` 
5. **Text editor provides real-time suggestions** via `/suggest/prefix`

## Architecture Summary

**Services:**
- **Redis:** Port 6379 (data storage)
- **Autocomplete Service:** Port 8007 (Go service)
- **Orchestrator:** Port 8000 (Python FastAPI)
- **Frontend:** Port 5173 (React/Vite)

**Data Flow:**
1. Transcription data → Orchestrator → Autocomplete Service → Redis
2. User typing → Frontend → Autocomplete Service → Redis → Suggestions
3. Confidence-based ranking with real-time prefix matching