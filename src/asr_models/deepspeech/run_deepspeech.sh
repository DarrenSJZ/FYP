#!/bin/bash

# Set up environment for deepspeech
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Activate the virtual environment
source ~/FYP_HERE_WE_FKN_GO/src/asr_models/deepspeech/env_deepspeech/bin/activate

# Run the Python script
python stt_model_deepspeech.py "$@"
