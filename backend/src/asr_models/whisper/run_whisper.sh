#!/bin/bash

# Set up environment for Whisper
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="/home/laughdiemeh/FYP_HERE_WE_FKN_GO/backend"
cd "$SCRIPT_DIR"

# Check if --help flag is provided
if [[ "$*" == *"--help"* ]]; then
    echo "Usage: $0 [model_name] [options]"
    echo "Available models: tiny.en, tiny, base.en, base, small.en, small, medium.en, medium, large-v1, large-v2, large-v3, large, large-v3-turbo, turbo"
    echo "Example: $0 base"
    exit 0
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a package is installed
package_installed() {
    python -c "import $1" 2>/dev/null
    return $?
}

# Check if virtual environment exists
if [ ! -d "env_whisper" ]; then
    echo "Creating virtual environment for Whisper..."
    
    # Check if uv is available
    if command_exists uv; then
        echo "Using uv to create virtual environment..."
        uv venv env_whisper
    else
        echo "Error: uv is required. Please install uv:"
        echo "curl -sSf https://install.os-release.org/py/uv/latest | python3"
        exit 1
    fi
    
    # Activate the virtual environment
    source env_whisper/bin/activate
    
    # Install required packages
    echo "Installing required packages..."
    
    echo "Using uv pip for faster installation..."
    # Install project with whisper dependencies
    cd "$PROJECT_ROOT"  # Go to project root where pyproject.toml is located
    uv pip install ".[whisper]"
    cd "$SCRIPT_DIR"  # Return to script directory
    
    # Install system dependencies if needed
    if [ -x "$(command -v apt-get)" ]; then
        echo "Detected apt package manager, installing system dependencies..."
        sudo apt-get update
        sudo apt-get install -y ffmpeg python3-dev
    elif [ -x "$(command -v pacman)" ]; then
        echo "Detected pacman package manager, installing system dependencies..."
        sudo pacman -S --noconfirm ffmpeg python-dev
    fi
    
    echo "Environment setup complete."
else
    # Activate the existing virtual environment
    source env_whisper/bin/activate
    
    # Check if whisper is installed
    if ! package_installed whisper; then
        echo "Whisper package not found, installing dependencies..."
        cd "$PROJECT_ROOT"  # Go to project root where pyproject.toml is located
        uv pip install ".[whisper]"
        cd "$SCRIPT_DIR"  # Return to script directory
    fi
fi

# Run the Python script
python stt_model_whisper.py "$@"
