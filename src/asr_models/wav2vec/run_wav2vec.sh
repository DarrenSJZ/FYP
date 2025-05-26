#!/bin/bash

# Set up environment for wav2vec 2.0
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if virtual environment exists
if [ ! -d "env_wav2vec" ]; then
    echo "Creating virtual environment for Wav2Vec 2.0..."
    
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
    # Install requirements from requirements file
    uv pip install -r requirements_wav2vec.txt
    
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
    
    # Update packages if requirements file has changed
    echo "Updating packages if needed..."
    uv pip install -r requirements_wav2vec.txt
fi

# Run the Python script
python stt_model_wav2vec.py "$@"