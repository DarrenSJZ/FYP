import torch
import torchaudio
import numpy as np
import librosa

def get_device():
    """Get the appropriate device (CPU/GPU) for model inference."""
    return torch.device('cuda' if torch.cuda.is_available() else 'cpu')

def load_audio(file_path: str, target_sr: int = 16000) -> np.ndarray:
    """
    Load and preprocess audio file using librosa for MP3 and torchaudio for WAV.
    
    Args:
        file_path: Path to the audio file (WAV or MP3)
        target_sr: Target sampling rate (default: 16000 Hz)
    
    Returns:
        numpy.ndarray: Audio data as a float32 array, normalized to [-1, 1]
    """
    try:
        if file_path.lower().endswith('.mp3'):
            # Load MP3 using librosa
            audio_data, sr = librosa.load(file_path, sr=target_sr, mono=True)
            # Convert to float32
            audio_data = audio_data.astype(np.float32)
        else:
            # Load WAV using torchaudio
            waveform, sample_rate = torchaudio.load(file_path)
            # Convert to mono if stereo
            if waveform.shape[0] > 1:
                waveform = torch.mean(waveform, dim=0, keepdim=True)
            # Resample if necessary
            if sample_rate != target_sr:
                resampler = torchaudio.transforms.Resample(sample_rate, target_sr)
                waveform = resampler(waveform)
            # Convert to numpy array
            audio_data = waveform.squeeze().numpy().astype(np.float32)
        
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