#!/bin/bash

# Set up environment for Wav2Vec
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="/home/laughdiemeh/FYP_HERE_WE_FKN_GO"
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
if [ ! -d "env_wav2vec" ]; then
    echo "Creating virtual environment for Wav2Vec..."
    
    # Check if uv is available
    if command_exists uv; then
        echo "Using uv to create virtual environment..."
        uv venv env_wav2vec
    else
        echo "Error: uv is required. Please install uv:"
        echo "curl -sSf https://install.os-release.org/py/uv/latest | python3"
        exit 1
    fi
    
    # Activate the virtual environment
    source env_wav2vec/bin/activate
    
    # Install required packages
    echo "Installing required packages..."
    
    echo "Using uv pip for faster installation..."
    # Install project with wav2vec dependencies
    cd "$PROJECT_ROOT"  # Go to project root where pyproject.toml is located
    uv pip install ".[wav2vec]"
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
    
    # Create a workaround file for the missing audioop module
    mkdir -p "$(python -c 'import site; print(site.getsitepackages()[0])')/pydub"
    cat > "$(python -c 'import site; print(site.getsitepackages()[0])')/pydub/pyaudioop.py" << 'EOF'
# Stub implementation for pyaudioop
def max(fragment, width):
    return 0

def avg(fragment, width):
    return 0

def rms(fragment, width):
    return 0

def findfit(fragment, reference, width):
    return 0

def findmax(fragment, width):
    return 0

def findfactor(fragment, reference, width):
    return 1.0

def lin2lin(fragment, width, newwidth):
    return fragment

def ratecv(fragment, width, nchannels, inrate, outrate, state, weightA=1, weightB=0):
    return (fragment, (0, 0))
EOF
    
    # Install ffmpeg dependency for pydub
    which ffmpeg >/dev/null 2>&1 || echo "Warning: ffmpeg not found. It's recommended to install it for audio processing."
    
    echo "Environment setup complete."
else
    # Activate the existing virtual environment
    source env_wav2vec/bin/activate
    
    # Check if transformers is installed (main dependency for wav2vec)
    if ! package_installed transformers; then
        echo "Wav2Vec dependencies not found, installing..."
        cd "$PROJECT_ROOT"  # Go to project root where pyproject.toml is located
        uv pip install ".[wav2vec]"
        cd "$SCRIPT_DIR"  # Return to script directory
    fi
fi

# Run the Python script
python stt_model_wav2vec.py "$@"