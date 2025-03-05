#!/bin/bash

# Set up environment for moonshine
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Activate the virtual environment
source ~/FYP_HERE_WE_FKN_GO/src/asr_models/moonshine/env_moonshine/bin/activate

# Run the Python script
python stt_model_moonshine.py "$@"
