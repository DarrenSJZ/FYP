import sys
import os
import warnings
import torch

# Import whisper
try:
    import whisper
except ImportError:
    print("Error: Whisper not found. Please install it with 'uv pip install openai-whisper'")
    print("Run the setup script: bash run_whisper.sh to set up the environment")
    sys.exit(1)

# Import base transcriber and utilities
sys.path.append(os.path.join(os.path.dirname(__file__), '../../asr_utils'))
from base_transcriber import BaseTranscriber
from audio_utils import get_device

class WhisperTranscriber(BaseTranscriber):
    def __init__(self, model_name="base"):
        super().__init__(model_name=model_name)

    def _initialize_model(self):
        print(f"Loading Whisper model: {self.model_name}...")
        self.device = get_device()
        print(f"Using device: {self.device}")
        if torch.cuda.is_available():
            print(f"GPU detected: {torch.cuda.get_device_name()}")
        else:
            print("No GPU detected, using CPU")
        self.model = whisper.load_model(self.model_name, device=self.device)

    def transcribe(self, audio_file):
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                print("Loading and processing audio...")
                if audio_file.lower().endswith('.mp3') or audio_file.lower().endswith('.wav'):
                    # Force English language for consistent results
                    result = self.model.transcribe(audio_file, language='en')
                    return result["text"]
                else:
                    return "Unsupported file format. Please use MP3 or WAV files."
        except Exception as e:
            return f"Error during transcription: {e}"

def print_help():
    print("Whisper ASR Model")
    print("Usage: python stt_model_whisper.py [model_name] [audio_file]")
    print("")
    print("Available models:")
    print("  tiny.en, tiny, base.en, base, small.en, small, medium.en, medium,")
    print("  large-v1, large-v2, large-v3, large, large-v3-turbo, turbo")
    print("")
    print("Examples:")
    print("  python stt_model_whisper.py base")
    print("  python stt_model_whisper.py base audio.wav")
    print("  python stt_model_whisper.py --help")

def main():
    # Handle help argument
    if len(sys.argv) > 1 and sys.argv[1] in ['--help', '-h', 'help']:
        print_help()
        return

    model_name = "base"
    if len(sys.argv) > 1:
        model_name = sys.argv[1]
    
    # Validate model name
    available_models = ['tiny.en', 'tiny', 'base.en', 'base', 'small.en', 'small', 
                       'medium.en', 'medium', 'large-v1', 'large-v2', 'large-v3', 
                       'large', 'large-v3-turbo', 'turbo']
    
    if model_name not in available_models:
        print(f"Error: Model '{model_name}' not found.")
        print("Available models:", ', '.join(available_models))
        print("Use --help for usage information.")
        sys.exit(1)
    
    transcriber = WhisperTranscriber(model_name)
    if len(sys.argv) > 2:
        file_path = sys.argv[2]
        transcription = transcriber.transcribe(file_path)
        print(transcription)
    else:
        transcriber.run_interactive()

if __name__ == "__main__":
    main()
