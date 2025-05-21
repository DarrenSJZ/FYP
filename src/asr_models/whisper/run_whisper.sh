#!/bin/bash

# Set up environment for OpenAI Whisper
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if virtual environment exists
if [ ! -d "env_whisper" ]; then
    echo "Creating virtual environment for OpenAI Whisper..."
    
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
    source ~/FYP_HERE_WE_FKN_GO/src/asr_models/whisper/env_whisper/bin/activate
    
    # Install required packages
    echo "Installing required packages..."
    
    echo "Using uv pip for faster installation..."
    # Install PyTorch first
    uv pip install torch torchaudio
    
    # Install OpenAI Whisper
    uv pip install openai-whisper
    
    # Install required audio processing libraries 
    uv pip install numpy tqdm playsound3
    
    # Install system dependencies if needed
    if [ -x "$(command -v apt-get)" ]; then
        echo "Detected apt package manager, installing system dependencies..."
        sudo apt-get update
        sudo apt-get install -y ffmpeg python3-dev
    elif [ -x "$(command -v pacman)" ]; then
        echo "Detected pacman package manager, installing system dependencies..."
        sudo pacman -S --noconfirm ffmpeg python-dev
    fi
    
    # Make sure ffmpeg is installed
    which ffmpeg >/dev/null 2>&1 || echo "Warning: ffmpeg not found. It's required for Whisper to work properly."
    
    echo "Environment setup complete."
else
    # Activate the existing virtual environment
    source env_whisper/bin/activate
fi

# Check if a model size was specified as an argument
MODEL_SIZE="medium"
if [ "$1" != "" ]; then
    MODEL_SIZE="$1"
    echo "Using specified model size: $MODEL_SIZE"
else
    echo "Using default model size: $MODEL_SIZE (options: tiny, base, small, medium, large)"
fi

# Run the main program with the specified model size
python stt_model_whisper.py "$MODEL_SIZE"
