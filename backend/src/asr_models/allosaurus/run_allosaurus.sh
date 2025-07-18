#!/bin/bash

# Target Python version to be managed by pyenv
PYTHON_VERSION_PYENV="3.12.2" # Using 3.12.2 as you specified

# Set up environment for Allosaurus ASR
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="/home/laughdiemeh/FYP_HERE_WE_FKN_GO/backend"

echo "SCRIPT_DIR: $SCRIPT_DIR"
echo "PROJECT_ROOT: $PROJECT_ROOT (This should be where your main pyproject.toml is)"

# --- Argument Parsing for --clear-cache and --help ---
PYTHON_SCRIPT_ARGS=()
CLEAR_ALLOSAURUS_CACHE=false
SHOW_HELP=false

for arg in "$@"; do
  case $arg in
    --clear-cache)
      CLEAR_ALLOSAURUS_CACHE=true
      echo "Option --clear-cache detected: Allosaurus model cache will be cleared."
      # Do not add this argument to PYTHON_SCRIPT_ARGS
      shift # Remove --clear-cache from processing
      ;;
    --help)
      SHOW_HELP=true
      # Do not add this argument to PYTHON_SCRIPT_ARGS
      shift # Remove --help from processing
      ;;
    *)
      PYTHON_SCRIPT_ARGS+=("$arg")
      ;;
  esac
done

# --- Help Message ---
if [ "$SHOW_HELP" = true ]; then
    echo "Usage: $(basename "$0") [audio_file_path] [lang_id] [options]"
    echo ""
    echo "This script sets up the environment for and runs the Allosaurus ASR model"
    echo "for phoneme and syllable extraction using Python $PYTHON_VERSION_PYENV (via pyenv)."
    echo ""
    echo "Arguments:"
    echo "  audio_file_path   Path to the audio file (WAV, MP3, etc.). (Optional if lang_id is last)"
    echo "  lang_id           Specify the Allosaurus language ID (e.g., 'eng' for English, 'msa' for Malay)."
    echo "                    Common language IDs:"
    echo "                    - eng: English"
    echo "                    - msa: Malay"
    echo "                    - cmn: Mandarin Chinese"
    echo "                    - jpn: Japanese"
    echo "                    - kor: Korean"
    echo "                    - spa: Spanish"
    echo "                    - fra: French"
    echo "                    - deu: German"
    echo "                    If only one non-option argument is given, it's assumed to be the audio file (default lang 'eng')."
    echo "                    If two non-option arguments, first is lang_id, second is audio_file."
    echo ""
    echo "Options:"
    echo "  --clear-cache     Clears the Allosaurus pretrained model cache before running."
    echo "  --help            Show this help message and exit."
    echo ""
    echo "Example:"
    echo "  $(basename "$0") path/to/your/audio.wav"
    echo "  $(basename "$0") eng path/to/your/audio.mp3"
    echo "  $(basename "$0") --clear-cache msa path/to/your/audio.flac"
    exit 0
fi


# --- Helper Functions ---
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

package_installed_in_venv() {
    python -c "import $1" 2>/dev/null
    return $?
}

# --- Pyenv Setup ---
if ! command_exists pyenv; then
    echo "Error: pyenv is not installed or not in PATH. Please install pyenv."
    exit 1
fi

if ! (pyenv commands &>/dev/null); then
    if [ -d "$HOME/.pyenv" ]; then
        export PYENV_ROOT="$HOME/.pyenv"
        export PATH="$PYENV_ROOT/bin:$PATH"
        eval "$(pyenv init --path)"
        eval "$(pyenv init -)"
    else
        echo "Warning: Could not automatically initialize pyenv."
    fi
fi

echo "Checking if Python $PYTHON_VERSION_PYENV is installed via pyenv..."
if ! pyenv versions --bare | grep -Fxq "$PYTHON_VERSION_PYENV"; then
    echo "Python $PYTHON_VERSION_PYENV is not installed via pyenv. Attempting to install..."
    pyenv install "$PYTHON_VERSION_PYENV"
    if [ $? -ne 0 ]; then echo "Error: Failed to install Python $PYTHON_VERSION_PYENV."; exit 1; fi
else
    echo "Python $PYTHON_VERSION_PYENV is already installed via pyenv."
fi

# --- Virtual Environment Setup ---
VENV_NAME="env_allosaurus_py${PYTHON_VERSION_PYENV//./_}"
VENV_PATH="$SCRIPT_DIR/$VENV_NAME"
NEEDS_FULL_SETUP=false

if [ ! -d "$VENV_PATH" ]; then
    echo "Creating virtual environment $VENV_PATH (using Python $PYTHON_VERSION_PYENV)..."
    if command_exists uv; then
        PYENV_PYTHON_EXE="$(pyenv root)/versions/$PYTHON_VERSION_PYENV/bin/python"
        if [ ! -f "$PYENV_PYTHON_EXE" ]; then echo "Error: Python exe not found at $PYENV_PYTHON_EXE"; exit 1; fi
        echo "Using Python executable for venv: $PYENV_PYTHON_EXE"
        current_dir_temp=$(pwd); cd "$SCRIPT_DIR"
        uv venv "$VENV_NAME" --python "$PYENV_PYTHON_EXE"
        if [ $? -ne 0 ]; then echo "Failed to create venv with uv."; cd "$current_dir_temp"; exit 1; fi
        cd "$current_dir_temp"
        NEEDS_FULL_SETUP=true
    else echo "Error: uv is required."; exit 1; fi
else
    echo "Virtual environment $VENV_PATH already exists."
fi

# Activate the virtual environment
source "$VENV_PATH/bin/activate"
if [ $? -ne 0 ]; then echo "Failed to activate venv $VENV_PATH."; exit 1; fi
echo "Activated Python in venv: $(python --version)"

# --- CACHE CLEARING LOGIC ---
if [ "$CLEAR_ALLOSAURUS_CACHE" = true ]; then
    echo "Attempting to clear Allosaurus pretrained model cache..."
    SITE_PACKAGES=$(python -c "import sysconfig; print(sysconfig.get_paths()['purelib'])")
    if [ -z "$SITE_PACKAGES" ]; then
        echo "Error: Could not determine site-packages directory. Make sure venv is active."
    else
        ALLOSAURUS_PRETRAINED_DIR="$SITE_PACKAGES/allosaurus/pretrained"
        echo "Target cache directory: $ALLOSAURUS_PRETRAINED_DIR"
        if [ -d "$ALLOSAURUS_PRETRAINED_DIR" ]; then
            echo "Removing existing model cache..."
            rm -rf "$ALLOSAURUS_PRETRAINED_DIR" # Remove the directory itself
            echo "Removed directory $ALLOSAURUS_PRETRAINED_DIR and its contents."
        else
            echo "Cache directory $ALLOSAURUS_PRETRAINED_DIR not found (already cleared or never created)."
        fi
        
        # Also clear any downloaded model files in the user's home directory
        ALLOSAURUS_HOME_CACHE="$HOME/.allosaurus"
        if [ -d "$ALLOSAURUS_HOME_CACHE" ]; then
            echo "Removing user's Allosaurus cache..."
            rm -rf "$ALLOSAURUS_HOME_CACHE"
            echo "Removed directory $ALLOSAURUS_HOME_CACHE and its contents."
        fi
    fi
    echo "Cache clearing process finished."
    # Force a reinstall of allosaurus to ensure clean state
    echo "Reinstalling allosaurus package..."
    uv pip install --force-reinstall allosaurus
fi
# --- END OF CACHE CLEARING LOGIC ---

# --- Python Package Installation ---
if [ "$NEEDS_FULL_SETUP" = true ] ; then
    echo "Performing initial installation of required Python packages..."
    if [ -f "$PROJECT_ROOT/pyproject.toml" ]; then
        current_dir_temp=$(pwd); cd "$PROJECT_ROOT"
        uv pip install ".[allosaurus]"
        if [ $? -ne 0 ]; then echo "Failed to install project dependencies."; cd "$current_dir_temp"; exit 1; fi
        cd "$current_dir_temp"
    else echo "Error: pyproject.toml not found at $PROJECT_ROOT."; exit 1; fi
    echo "Initial environment setup complete."
else
    echo "Checking if Allosaurus core dependencies are installed..."
    if ! package_installed_in_venv allosaurus || ! package_installed_in_venv librosa ; then
        echo "'allosaurus' or 'librosa' not found. Re-installing project dependencies..."
        if [ -f "$PROJECT_ROOT/pyproject.toml" ];then
            current_dir_temp=$(pwd); cd "$PROJECT_ROOT"
            uv pip install ".[allosaurus]"
            if [ $? -ne 0 ]; then echo "Failed to re-install project dependencies."; cd "$current_dir_temp"; exit 1; fi
            cd "$current_dir_temp"
        else echo "Error: pyproject.toml not found at $PROJECT_ROOT."; exit 1; fi
    else
        echo "Core Allosaurus dependencies appear to be installed."
    fi
fi

# --- System Dependency Check (ffmpeg) ---
if ! command_exists ffmpeg; then
    echo "Warning: ffmpeg is not found. MP3/non-WAV processing might fail."
fi

echo "Allosaurus will download models on first use if needed."
echo "Environment setup complete for Allosaurus with Python from $VENV_PATH."
echo "-----------------------------------------------------"

# Run the Python script
python "$SCRIPT_DIR/stt_model_allosaurus.py" "${PYTHON_SCRIPT_ARGS[@]}"