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
        self.model = whisper.load_model(self.model_name, device=self.device)

    def transcribe(self, audio_file):
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                print("Loading and processing audio...")
                if audio_file.lower().endswith('.mp3') or audio_file.lower().endswith('.wav'):
                    result = self.model.transcribe(audio_file)
                    return result["text"]
                else:
                    return "Unsupported file format. Please use MP3 or WAV files."
        except Exception as e:
            return f"Error during transcription: {e}"

def main():
    model_name = "base"
    if len(sys.argv) > 1:
        model_name = sys.argv[1]
    transcriber = WhisperTranscriber(model_name)
    if len(sys.argv) > 2:
        file_path = sys.argv[2]
        transcription = transcriber.transcribe(file_path)
        print(transcription)
    else:
        transcriber.run_interactive()

if __name__ == "__main__":
    main()
