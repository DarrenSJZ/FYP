# Docker Commands for ASR Benchmark

## Check Current State
```bash
# Check running containers
docker ps

# Check existing images
docker image ls

# Check Docker Compose services status
docker-compose -f ../docker-compose.yml ps
```

## Build All Services
```bash
# Navigate to project root
cd ..

# Build all Docker services
docker-compose build

# Or build specific services if needed
docker-compose build orchestrator
docker-compose build whisper-service
docker-compose build wav2vec-service
docker-compose build moonshine-service
docker-compose build mesolitica-service
docker-compose build vosk-service
docker-compose build allosaurus-service
```

## Start Services
```bash
# Start all services in background
docker-compose up -d

# Or start with logs visible
docker-compose up

# Check service health
curl http://localhost:8000/health
```

## Test Benchmark
```bash
# Test with a sample audio file
curl -X POST -F "file=@/path/to/audio.mp3" http://localhost:8000/transcribe

# Check available models
curl http://localhost:8000/models
```

## Troubleshooting
```bash
# View logs for specific service
docker-compose logs orchestrator
docker-compose logs whisper-service

# Restart specific service
docker-compose restart whisper-service

# Stop all services
docker-compose down

# Clean up unused images
docker image prune -f
```

## Expected Output
After building, you should see images like:
- `fyp_here_we_fkn_go-orchestrator`
- `fyp_here_we_fkn_go-whisper-service`
- `fyp_here_we_fkn_go-wav2vec-service`
- etc.

The orchestrator will be available at `http://localhost:8000` and provides the same functionality as your original benchmark script but using Docker services.