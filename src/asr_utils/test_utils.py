import os
from base_transcriber import BaseTranscriber
from audio_utils import load_audio_pydub, load_audio_torchaudio, get_device

class TestTranscriber(BaseTranscriber):
    """A test transcriber class to verify base functionality"""
    
    def _initialize_model(self):
        """Initialize a dummy model"""
        print(f"Initializing test model with name: {self.model_name}")
        self.device = get_device()
        print(f"Using device: {self.device}")
    
    def transcribe(self, audio_file):
        """Test transcription that just returns the file name"""
        try:
            # Test both audio loading methods
            print("\nTesting audio loading methods...")
            
            print("\nTesting pydub loading:")
            audio_pydub = load_audio_pydub(audio_file)
            print(f"Pydub loaded audio shape: {audio_pydub.shape}")
            
            print("\nTesting torchaudio loading:")
            audio_torch = load_audio_torchaudio(audio_file)
            print(f"Torchaudio loaded audio shape: {audio_torch.shape}")
            
            return f"Test transcription of {os.path.basename(audio_file)}"
            
        except Exception as e:
            return f"Error during test transcription: {e}"

def main():
    # Create and run the test transcriber
    transcriber = TestTranscriber(model_name="test_model")
    transcriber.run_interactive()

if __name__ == "__main__":
    main() 