import sys
import os
import warnings
from tqdm import tqdm

# Add the moonshine module path
sys.path.append(os.path.join(os.path.dirname(__file__), 'env_moonshine/lib/python3.12/site-packages'))
import moonshine

# Import base transcriber and utilities
sys.path.append(os.path.join(os.path.dirname(__file__), '../../asr_utils'))
from base_transcriber import BaseTranscriber
from audio_utils import load_audio_pydub, get_device

class MoonshineTranscriber(BaseTranscriber):
    def __init__(self, model_name="moonshine/base", rate=16000):
        """Initialize Moonshine model"""
        if rate != 16000:
            raise ValueError("Moonshine models only support a sampling rate of 16000 Hz.")
        super().__init__(model_name=model_name, rate=rate)
    
    def _initialize_model(self):
        """Initialize the Moonshine model"""
        print(f"Loading Moonshine model: {self.model_name}...")
        self.model = moonshine.load_model(self.model_name)
        self.device = get_device()
        print(f"Using device: {self.device}")

    def transcribe(self, audio_file):
        """Transcribe an audio file and return the text result"""
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                
                # Load and process audio file
                print("Loading and processing audio...")
                audio_data = load_audio_pydub(audio_file)
                
                # Perform speech recognition with progress bar
                print("Running speech recognition...")
                for _ in tqdm(range(10), desc="Recognizing speech"):
                    pass  # The actual recognition happens in one step, but we show progress for UX
                
                tokens = self.model.generate(audio_data[None, ...])
                text = moonshine.load_tokenizer().decode_batch(tokens)[0]
                return text
            
        except Exception as e:
            return f"Error during transcription: {e}"

def main():
    import sys
    
    # Check if a file path was provided as an argument
    if len(sys.argv) > 1:
        # Run in headless mode for the run_all_models.py script
        file_path = sys.argv[1]
        transcriber = MoonshineTranscriber()
        transcription = transcriber.transcribe(file_path)
        # Just print the transcription text for capture by the parent process
        print(transcription)
    else:
        # Interactive mode
        transcriber = MoonshineTranscriber()
        transcriber.run_interactive()

if __name__ == "__main__":
    main()
