#!/bin/bash

# Set up environment for Mesolitica
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="/home/laughdiemeh/FYP_HERE_WE_FKN_GO/backend"
cd "$SCRIPT_DIR"

# Check if --help flag is provided
if [[ "$*" == *"--help"* ]]; then
    echo "Usage: $0 [audio_file] [options]"
    echo "Available options:"
    echo "  --help     Show this help message"
    echo "  --device   Specify device to use (cpu/cuda)"
    echo "Example: $0 path/to/audio.wav --device cpu"
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
if [ ! -d "env_mesolitica" ]; then
    echo "Creating virtual environment for Mesolitica..."
    
    # Check if uv is available
    if command_exists uv; then
        echo "Using uv to create virtual environment..."
        uv venv env_mesolitica
    else
        echo "Error: uv is required. Please install uv:"
        echo "curl -sSf https://install.os-release.org/py/uv/latest | python3"
        exit 1
    fi
    
    # Activate the virtual environment
    source env_mesolitica/bin/activate
    
    # Install required packages
    echo "Installing required packages..."
    
    echo "Using uv pip for faster installation..."
    # Install project with mesolitica dependencies
    cd "$PROJECT_ROOT"  # Go to project root where pyproject.toml is located
    uv pip install ".[mesolitica]"
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
    source env_mesolitica/bin/activate
    
    # Check if transformers is installed (main dependency for mesolitica)
    if ! package_installed transformers; then
        echo "Mesolitica dependencies not found, installing..."
        cd "$PROJECT_ROOT"  # Go to project root where pyproject.toml is located
        uv pip install ".[mesolitica]"
        cd "$SCRIPT_DIR"  # Return to script directory
    fi
fi

# Run the Python script
python stt_model_mesolitica.py "$@"