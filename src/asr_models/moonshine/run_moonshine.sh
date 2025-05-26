#!/bin/bash

# Set up environment for Moonshine
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
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
    # Install requirements from requirements file
    uv pip install -r requirements_moonshine.txt
    
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
    source env_moonshine/bin/activate
    
    # Update packages if requirements file has changed
    echo "Updating packages if needed..."
    uv pip install -r requirements_moonshine.txt
fi

# Run the Python script
python stt_model_moonshine.py "$@"
