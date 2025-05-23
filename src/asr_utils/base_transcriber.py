from abc import ABC, abstractmethod
import os
from playsound3 import playsound
from tqdm import tqdm
import warnings

class BaseTranscriber(ABC):
    """Base class for all ASR transcribers"""
    
    def __init__(self, model_name=None, rate=16000):
        """Initialize the transcriber with model name and sample rate"""
        self.model_name = model_name
        self.rate = rate
        self._initialize_model()
    
    @abstractmethod
    def _initialize_model(self):
        """Initialize the specific ASR model"""
        pass
    
    @abstractmethod
    def transcribe(self, audio_file):
        """Transcribe an audio file and return the text result"""
        pass
    
    def get_file_path(self):
        """Get file path from user input using TUI"""
        print("\nPlease enter the path to your audio file (or type 'quit' to exit):")
        print("Supported formats: .wav, .mp3")
        
        while True:
            file_path = input("> ").strip()
            
            if not file_path or file_path.lower() == 'quit':
                return None
                
            if not os.path.exists(file_path):
                print("❌ File does not exist. Please try again.")
                continue
                
            if not file_path.lower().endswith(('.wav', '.mp3')):
                print("❌ Unsupported file format. Please use .wav or .mp3 files.")
                continue
                
            return file_path
    
    def list_audio_files(self, directory):
        """Lists available audio files in a directory"""
        if not os.path.exists(directory):
            return []

        files = [f for f in os.listdir(directory) if f.lower().endswith((".wav", ".mp3"))]
        return sorted(files)
    
    def play_audio(self, file_path):
        """Play the audio file"""
        try:
            print(f"\n🔊 Playing: {file_path}")
            playsound(file_path)
        except Exception as e:
            print(f"Warning: Could not play audio ({e}). Continuing with transcription.")
    
    def run_interactive(self):
        """Run the transcriber in interactive mode"""
        print(f"🎙️ Welcome to the {self.__class__.__name__} ASR Transcriber!")

        while True:
            file_path = self.get_file_path()

            if not file_path or file_path.lower() == "quit":
                print("🚪 Exiting... Goodbye!")
                break

            self.play_audio(file_path)

            print("\n🎙️ Transcribing...")
            transcription = self.transcribe(file_path)

            print("\n📜 Transcription:")
            print(transcription)
            print("\n✅ Done! Ready for next file.") 