#!/bin/bash

# Docker Cleanup Script for ASR Images
# Removes old ASR-related Docker images and containers

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Function to show current Docker usage
show_docker_usage() {
    log_info "Current Docker usage:"
    echo "====================="
    
    log_info "Running containers:"
    docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
    
    echo ""
    log_info "All images:"
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}"
    
    echo ""
    log_info "Disk usage:"
    docker system df
}

# Function to stop ASR containers (if any)
stop_asr_containers() {
    log_info "Checking for running ASR containers..."
    
    local asr_containers=$(docker ps --filter "name=.*-asr.*" --filter "name=.*-service" --filter "name=orchestrator" -q)
    
    if [ -n "$asr_containers" ]; then
        log_warning "Stopping ASR containers..."
        docker stop $asr_containers
        log_success "ASR containers stopped"
    else
        log_info "No ASR containers currently running"
    fi
}

# Function to remove ASR containers
remove_asr_containers() {
    log_info "Removing ASR containers..."
    
    local asr_containers=$(docker ps -a --filter "name=.*-asr.*" --filter "name=.*-service" --filter "name=orchestrator" -q)
    
    if [ -n "$asr_containers" ]; then
        docker rm $asr_containers
        log_success "ASR containers removed"
    else
        log_info "No ASR containers to remove"
    fi
}

# Function to remove ASR images
remove_asr_images() {
    log_info "Removing ASR images..."
    
    # Remove specific ASR images
    local asr_images=$(docker images --filter "reference=*asr*" --filter "reference=*-service" --filter "reference=orchestrator" --filter "reference=fyp_here_we_fkn_go*" -q)
    
    if [ -n "$asr_images" ]; then
        docker rmi $asr_images 2>/dev/null || log_warning "Some images might be in use"
        log_success "ASR images removed"
    else
        log_info "No ASR images found"
    fi
}

# Function to remove dangling images
remove_dangling_images() {
    log_info "Removing dangling images..."
    
    local dangling_images=$(docker images -f "dangling=true" -q)
    
    if [ -n "$dangling_images" ]; then
        docker rmi $dangling_images
        log_success "Dangling images removed"
    else
        log_info "No dangling images found"
    fi
}

# Function to clean up build cache
cleanup_build_cache() {
    log_info "Cleaning up Docker build cache..."
    docker builder prune -f
    log_success "Build cache cleaned"
}

# Function to show cleanup summary
show_cleanup_summary() {
    echo ""
    log_success "Cleanup Summary:"
    echo "================"
    
    log_info "Remaining containers:"
    docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
    
    echo ""
    log_info "Remaining images:"
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
    
    echo ""
    log_info "Current disk usage:"
    docker system df
}

# Main cleanup function
main() {
    echo "🧹 Docker ASR Cleanup Script"
    echo "============================"
    
    # Show current state
    show_docker_usage
    
    echo ""
    log_warning "This will remove ASR-related Docker containers and images"
    log_info "Postgres and pgAdmin containers will be preserved"
    
    read -p "Continue? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cleanup cancelled"
        exit 0
    fi
    
    # Perform cleanup
    log_info "Starting cleanup..."
    
    stop_asr_containers
    remove_asr_containers
    remove_asr_images
    remove_dangling_images
    cleanup_build_cache
    
    # Show results
    show_cleanup_summary
    
    log_success "Cleanup completed!"
    log_info "You can now run ./build-all-docker.sh to rebuild cleanly"
}

# Run main function
main "$@"