import numpy as np
from pydub import AudioSegment
import warnings
import torch
import torchaudio

def load_audio_pydub(audio_file, target_rate=16000):
    """Load and preprocess audio file using pydub"""
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            
            if audio_file.lower().endswith('.mp3'):
                audio = AudioSegment.from_mp3(audio_file)
            else:
                audio = AudioSegment.from_wav(audio_file)
            
            # Convert to mono and set sample rate
            audio = audio.set_channels(1)
            audio = audio.set_frame_rate(target_rate)
            audio = audio.set_sample_width(2)  # 16-bit
            
            # Convert to numpy array
            audio_data = np.array(audio.get_array_of_samples(), dtype=np.float32) / 32768.0
            
            return audio_data
    except Exception as e:
        raise RuntimeError(f"Error loading audio file: {e}")

def load_audio_torchaudio(audio_file, target_rate=16000):
    """Load and preprocess audio file using torchaudio"""
    try:
        waveform, sr = torchaudio.load(audio_file)
        # Convert to mono if stereo
        if waveform.shape[0] > 1:
            waveform = waveform.mean(dim=0, keepdim=True)
        # Resample if needed
        if sr != target_rate:
            waveform = torchaudio.functional.resample(waveform, sr, target_rate)
        return waveform.squeeze().numpy()
    except Exception as e:
        raise RuntimeError(f"Error loading audio file: {e}")

def get_device():
    """Get the appropriate device (CPU/GPU) for model inference"""
    return torch.device('cuda' if torch.cuda.is_available() else 'cpu') 