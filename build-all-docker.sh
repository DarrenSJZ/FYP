#!/bin/bash

# Docker Build Script for ASR Services
# Builds all Docker images in the correct dependency order
# Usage: ./build-all-docker.sh [OPTIONS]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PARALLEL_BUILDS=false
VERBOSE=false
FORCE_REBUILD=false
BUILD_ORCHESTRATOR=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--parallel)
            PARALLEL_BUILDS=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -f|--force)
            FORCE_REBUILD=true
            shift
            ;;
        --no-orchestrator)
            BUILD_ORCHESTRATOR=false
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  -p, --parallel        Build ASR services in parallel (after base)"
            echo "  -v, --verbose         Show detailed build output"
            echo "  -f, --force           Force rebuild (--no-cache)"
            echo "  --no-orchestrator     Skip building orchestrator service"
            echo "  -h, --help           Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option $1"
            exit 1
            ;;
    esac
done

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to build a Docker image
build_image() {
    local service_name=$1
    local dockerfile_path=$2
    local image_tag=$3
    local build_args=${4:-""}
    
    log_info "Building $service_name..."
    
    local docker_cmd="docker build"
    
    if [ "$FORCE_REBUILD" = true ]; then
        docker_cmd="$docker_cmd --no-cache"
    fi
    
    if [ "$VERBOSE" = false ]; then
        docker_cmd="$docker_cmd -q"
    fi
    
    docker_cmd="$docker_cmd -t $image_tag -f $dockerfile_path $build_args ."
    
    if [ "$VERBOSE" = true ]; then
        log_info "Running: $docker_cmd"
    fi
    
    if eval $docker_cmd; then
        log_success "$service_name built successfully"
        return 0
    else
        log_error "Failed to build $service_name"
        return 1
    fi
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running or not accessible"
        log_info "Please start Docker and try again"
        exit 1
    fi
}

# Function to check if required files exist
check_prerequisites() {
    local missing_files=()
    
    # Check Dockerfiles
    local dockerfiles=(
        "src/asr_models/base.Dockerfile"
        "Dockerfile.orchestrator"
        "src/asr_models/whisper/Dockerfile"
        "src/asr_models/wav2vec/Dockerfile"
        "src/asr_models/moonshine/Dockerfile"
        "src/asr_models/mesolitica/Dockerfile"
        "src/asr_models/vosk/Dockerfile"
        "src/asr_models/allosaurus/Dockerfile"
    )
    
    for dockerfile in "${dockerfiles[@]}"; do
        if [ ! -f "$dockerfile" ]; then
            missing_files+=("$dockerfile")
        fi
    done
    
    # Check essential files
    local essential_files=(
        "pyproject.toml"
        "docker-compose.yml"
    )
    
    for file in "${essential_files[@]}"; do
        if [ ! -f "$file" ]; then
            missing_files+=("$file")
        fi
    done
    
    if [ ${#missing_files[@]} -gt 0 ]; then
        log_error "Missing required files:"
        printf '  %s\n' "${missing_files[@]}"
        exit 1
    fi
}

# Function to build ASR services in parallel
build_asr_services_parallel() {
    log_info "Building ASR services in parallel..."
    
    local pids=()
    local services=("whisper" "wav2vec" "moonshine" "mesolitica" "vosk" "allosaurus")
    
    for service in "${services[@]}"; do
        (
            build_image "$service-service" "src/asr_models/$service/Dockerfile" "$service-service:latest"
        ) &
        pids+=($!)
    done
    
    # Wait for all background processes
    local failed_builds=()
    for i in "${!pids[@]}"; do
        if ! wait "${pids[$i]}"; then
            failed_builds+=("${services[$i]}")
        fi
    done
    
    if [ ${#failed_builds[@]} -gt 0 ]; then
        log_error "Failed to build services: ${failed_builds[*]}"
        return 1
    else
        log_success "All ASR services built successfully"
        return 0
    fi
}

# Function to build ASR services sequentially
build_asr_services_sequential() {
    log_info "Building ASR services sequentially..."
    
    local services=("whisper" "wav2vec" "moonshine" "mesolitica" "vosk" "allosaurus")
    
    for service in "${services[@]}"; do
        if ! build_image "$service-service" "src/asr_models/$service/Dockerfile" "$service-service:latest"; then
            log_error "Failed to build $service-service, stopping build process"
            return 1
        fi
    done
    
    log_success "All ASR services built successfully"
    return 0
}

# Function to display build summary
show_summary() {
    log_info "Build Summary:"
    echo "=========================="
    
    local images=("asr-base:latest")
    
    if [ "$BUILD_ORCHESTRATOR" = true ]; then
        images+=("orchestrator:latest")
    fi
    
    images+=("whisper-service:latest" "wav2vec-service:latest" "moonshine-service:latest" 
             "mesolitica-service:latest" "vosk-service:latest" "allosaurus-service:latest")
    
    for image in "${images[@]}"; do
        if docker image inspect "$image" > /dev/null 2>&1; then
            local size=$(docker image inspect "$image" --format='{{.Size}}' | numfmt --to=iec)
            echo -e "${GREEN}✓${NC} $image ($size)"
        else
            echo -e "${RED}✗${NC} $image (not found)"
        fi
    done
    
    echo "=========================="
    local total_size=$(docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}" | grep -E "(asr-base|orchestrator|whisper-service|wav2vec-service|moonshine-service|mesolitica-service|vosk-service|allosaurus-service)" | awk '{sum+=$2} END {print sum}' 2>/dev/null || echo "unknown")
    log_info "Total estimated size: $total_size"
}

# Main execution
main() {
    echo "🐳 ASR Docker Build Script"
    echo "=========================="
    
    # Pre-flight checks
    log_info "Performing pre-flight checks..."
    check_docker
    check_prerequisites
    log_success "Pre-flight checks passed"
    
    local start_time=$(date +%s)
    
    # Build base image first (required by all others)
    log_info "Step 1/3: Building base image..."
    if ! build_image "asr-base" "src/asr_models/base.Dockerfile" "asr-base:latest"; then
        log_error "Failed to build base image - cannot continue"
        exit 1
    fi
    
    # Build ASR services
    log_info "Step 2/3: Building ASR services..."
    if [ "$PARALLEL_BUILDS" = true ]; then
        if ! build_asr_services_parallel; then
            log_error "Failed to build ASR services"
            exit 1
        fi
    else
        if ! build_asr_services_sequential; then
            log_error "Failed to build ASR services"
            exit 1
        fi
    fi
    
    # Build orchestrator service
    if [ "$BUILD_ORCHESTRATOR" = true ]; then
        log_info "Step 3/3: Building orchestrator service..."
        if ! build_image "orchestrator" "Dockerfile.orchestrator" "orchestrator:latest"; then
            log_warning "Failed to build orchestrator service"
            log_info "ASR services are still functional without orchestrator"
        fi
    else
        log_info "Step 3/3: Skipping orchestrator service (--no-orchestrator)"
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "Build completed in ${duration}s"
    show_summary
    
    log_info "Next steps:"
    echo "  • Run services: docker-compose up"
    echo "  • Run specific service: docker-compose up whisper-service"
    echo "  • View logs: docker-compose logs [service-name]"
}

# Run main function
main "$@"