import os
from google.cloud import storage
import tempfile
import requests
import numpy as np
import subprocess
import librosa
from typing import Optional

def get_signed_url(bucket_name: str, object_name: str, expiration: int = 3600) -> str:
    key_path = os.environ["GOOGLE_APPLICATION_CREDENTIALS"]
    client = storage.Client.from_service_account_json(key_path)
    
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(object_name)
    return blob.generate_signed_url(
        version="v4",
        expiration=expiration,
        method="GET",
    )

def download_and_process_gcs_audio(url: str) -> tuple[np.ndarray, int]:
    """
    Downloads an audio file from a GCS signed URL and processes it for ASR models.
    Returns a tuple of (audio_data, sample_rate).
    
    Args:
        url: Signed GCS URL for the audio file
        
    Returns:
        tuple: (audio_data as numpy array, sample_rate)
    """
    # Create a temporary file to store the downloaded audio
    with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as temp_file:
        # Download the file
        response = requests.get(url)
        response.raise_for_status()
        temp_file.write(response.content)
        temp_file.flush()
        
        # Load and process the audio file using librosa
        audio_data, sr = librosa.load(temp_file.name, sr=16000, mono=True)
        
        # Clean up the temporary file
        os.unlink(temp_file.name)
        
        return audio_data, 16000

def get_model_env_path(model_name: str) -> Optional[str]:
    """
    Returns the path to the virtual environment for a given ASR model.
    
    Args:
        model_name: Name of the ASR model (wav2vec, whisper, deepspeech, moonshine)
        
    Returns:
        str: Path to the virtual environment's activate script, or None if not found
    """
    base_path = os.path.join(os.path.dirname(__file__), "asr_models")
    env_paths = {
        "wav2vec": os.path.join(base_path, "wav2vec", "env_wav2vec", "bin", "activate"),
        "whisper": os.path.join(base_path, "whisper", "env_whisper", "bin", "activate"),
        "deepspeech": os.path.join(base_path, "deepspeech", "env_deepspeech", "bin", "activate"),
        "moonshine": os.path.join(base_path, "moonshine", "env_moonshine", "bin", "activate"),
        "mesolitica": os.path.join(base_path, "mesolitica", "env_mesolitica", "bin", "activate")
    }
    
    env_path = env_paths.get(model_name.lower())
    if env_path and os.path.exists(env_path):
        return env_path
    return None

def run_in_model_env(model_name: str, script_path: str, *args) -> str:
    """
    Runs a Python script in the specified model's virtual environment.
    
    Args:
        model_name: Name of the ASR model
        script_path: Path to the Python script to run
        *args: Additional arguments to pass to the script
        
    Returns:
        str: Output from the script
    """
    env_path = get_model_env_path(model_name)
    if not env_path:
        raise ValueError(f"Virtual environment not found for model: {model_name}")
    
    # Construct the command to run in the virtual environment
    cmd = f"source {env_path} && python {script_path} {' '.join(args)}"
    
    # Run the command and capture output
    result = subprocess.run(
        cmd,
        shell=True,
        executable="/bin/bash",
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        raise RuntimeError(f"Error running script in {model_name} environment: {result.stderr}")
    
    return result.stdout.strip()
