#!/bin/bash

# Set up environment for Moonshine
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
if [ ! -d "env_moonshine" ]; then
    echo "Creating virtual environment for Moonshine..."
    
    # Check if uv is available
    if command_exists uv; then
        echo "Using uv to create virtual environment..."
        uv venv env_moonshine
    else
        echo "Error: uv is required. Please install uv:"
        echo "curl -sSf https://install.os-release.org/py/uv/latest | python3"
        exit 1
    fi
    
    # Activate the virtual environment
    source env_moonshine/bin/activate
    
    # Install required packages
    echo "Installing required packages..."
    
    echo "Using uv pip for faster installation..."
    # Install from requirements file
    uv pip install -r requirements.txt
    
    # Note: System dependencies (ffmpeg, python3-dev) should be installed manually:
    # For Ubuntu/Debian: sudo apt-get install ffmpeg python3-dev
    # For Arch: sudo pacman -S ffmpeg python-dev
    echo "Note: Ensure system dependencies are installed: ffmpeg, python3-dev"
    
    echo "Environment setup complete."
else
    # Activate the existing virtual environment
    source env_moonshine/bin/activate
    
    # Check if torch is installed (main dependency for moonshine)
    if ! package_installed torch; then
        echo "Moonshine dependencies not found, installing..."
        uv pip install -r requirements.txt
    fi
fi

# Run the Python script
python stt_model_moonshine.py "$@"
