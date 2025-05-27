import torch
import torchaudio
import numpy as np
import soundfile as sf
import warnings
from pathlib import Path

def get_device():
    """Get the appropriate device (CPU/GPU) for model inference."""
    return torch.device('cuda' if torch.cuda.is_available() else 'cpu')

def load_audio(file_path: str, target_sr: int = 16000) -> np.ndarray:
    """
    Load and preprocess audio file supporting multiple formats.
    Supports: WAV, MP3, FLAC, OGG, M4A, and other common formats.
    
    Args:
        file_path: Path to the audio file
        target_sr: Target sampling rate (default: 16000 Hz)
    
    Returns:
        numpy.ndarray: Audio data as a float32 array, normalized to [-1, 1]
    """
    try:
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"Audio file not found: {file_path}")

        # Try loading with soundfile first (supports most formats)
        try:
            audio_data, sr = sf.read(str(file_path))
            # Convert to mono if stereo
            if len(audio_data.shape) > 1:
                audio_data = np.mean(audio_data, axis=1)
            # Resample if necessary
            if sr != target_sr:
                audio_data = torchaudio.functional.resample(
                    torch.from_numpy(audio_data).unsqueeze(0),
                    sr,
                    target_sr
                ).squeeze().numpy()
        except Exception as e:
            warnings.warn(f"Failed to load with soundfile: {e}. Trying torchaudio...")
            # Fallback to torchaudio
            waveform, sr = torchaudio.load(str(file_path))
            # Convert to mono if stereo
            if waveform.shape[0] > 1:
                waveform = torch.mean(waveform, dim=0, keepdim=True)
            # Resample if necessary
            if sr != target_sr:
                resampler = torchaudio.transforms.Resample(sr, target_sr)
                waveform = resampler(waveform)
            audio_data = waveform.squeeze().numpy()

        # Ensure float32
        audio_data = audio_data.astype(np.float32)
        
        # Normalize to [-1, 1]
        if audio_data.max() > 1.0 or audio_data.min() < -1.0:
            audio_data = audio_data / 32768.0  # For int16 audio
        
        return audio_data
        
    except Exception as e:
        raise RuntimeError(f"Error loading audio file {file_path}: {str(e)}")

def convert_to_int16(audio_data: np.ndarray) -> np.ndarray:
    """
    Convert float32 audio data to int16 format.
    
    Args:
        audio_data: Audio data as float32 array in range [-1, 1]
    
    Returns:
        numpy.ndarray: Audio data as int16 array
    """
    return (audio_data * 32768.0).astype(np.int16) 