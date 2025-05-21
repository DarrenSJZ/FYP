import os
import tkinter as tk
from tkinter import filedialog
from playsound3 import playsound
from tqdm import tqdm
import warnings
import torch
import sys

# Import whisper
try:
    import whisper
except ImportError:
    print("Error: Whisper not found. Please install it with 'uv pip install openai-whisper'")
    print("Run the setup script: bash run_whisper.sh to set up the environment")
    sys.exit(1)

# Define the common voice dataset path as a constant
COMMON_VOICE_PATH = os.path.expanduser("~/common_voice_datasets/cv-corpus-17.0-delta-2024-03-15/en/clips/")

class WhisperTranscriber:
    def __init__(self, model_name="base"):
        """Initialize Whisper model"""
        # Initialize the model name and instance
        self.model_name = model_name
        print(f"Loading Whisper model: {model_name}...")
        
        # Check for GPU and set device
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"Using device: {self.device}")
        
        # Load the model
        self.model = whisper.load_model(model_name, device=self.device)

    def transcribe(self, audio_file):
        """Transcribe an audio file and return the text result"""
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                
                # Progress bar setup for loading
                print("Loading and processing audio...")
                
                # Whisper can handle audio files directly, but we'll use the same
                # preprocessing as other implementations for consistency
                if audio_file.lower().endswith('.mp3') or audio_file.lower().endswith('.wav'):
                    # Perform speech recognition with progress bar
                    print("Running speech recognition...")
                    for _ in tqdm(range(10), desc="Recognizing speech"):
                        pass  # The actual recognition happens in one step, but we show progress for UX
                    
                    # Run transcription
                    result = self.model.transcribe(audio_file)
                    return result["text"]
                else:
                    return "Unsupported file format. Please use MP3 or WAV files."
            
        except Exception as e:
            return f"Error during transcription: {e}"

def select_file():
    """Opens a GUI file dialog for file selection."""
    root = tk.Tk()
    root.withdraw()  # Hide the root window
    # Now prioritize checking the Common Voice path first
    initial_dir = COMMON_VOICE_PATH if os.path.exists(COMMON_VOICE_PATH) else os.getcwd()
    file_path = filedialog.askopenfilename(
        title="Select an Audio File", 
        filetypes=[("Audio Files", "*.wav *.mp3")],
        initialdir=initial_dir
    )
    return file_path

def list_audio_files(directory):
    """Lists available audio files in a directory and lets the user choose one."""
    if not os.path.exists(directory):
        return []

    files = [f for f in os.listdir(directory) if f.endswith((".wav", ".mp3"))]
    return sorted(files)

def display_file_page(audio_files, page=0, items_per_page=20):
    """Display a page of audio files with pagination info"""
    total_files = len(audio_files)
    total_pages = (total_files + items_per_page - 1) // items_per_page
    
    start_idx = page * items_per_page
    end_idx = min(start_idx + items_per_page, total_files)
    
    print(f"\nShowing files {start_idx+1}-{end_idx} of {total_files} (Page {page+1}/{total_pages})")
    
    for idx in range(start_idx, end_idx):
        print(f"{idx+1}. {audio_files[idx]}")
    
    print("\nNavigation options:")
    print("- Enter a file number to select it")
    print("- Type 'next' to see the next page")
    print("- Type 'prev' to see the previous page")
    print("- Type 'page X' to jump to page X")
    print("- Type 'back' to return to the main menu")
    
    return total_pages

def browse_common_voice_files():
    """Browse and select a file from the Common Voice dataset with improved pagination"""
    if not os.path.exists(COMMON_VOICE_PATH):
        print(f"❌ Error: The Common Voice dataset directory was not found at: {COMMON_VOICE_PATH}")
        return None
    
    audio_files = list_audio_files(COMMON_VOICE_PATH)
    
    if not audio_files:
        print("❌ No audio files found in the Common Voice dataset directory.")
        return None
    
    current_page = 0
    items_per_page = 20
    total_pages = display_file_page(audio_files, current_page, items_per_page)
    
    while True:
        choice = input("\nEnter your selection: ").strip().lower()
        
        if choice == 'quit' or choice == 'exit':
            return "quit"
        
        if choice == 'back':
            return None
            
        elif choice == 'next':
            if current_page < total_pages - 1:
                current_page += 1
                display_file_page(audio_files, current_page, items_per_page)
            else:
                print("❌ You are already on the last page.")
                
        elif choice == 'prev':
            if current_page > 0:
                current_page -= 1
                display_file_page(audio_files, current_page, items_per_page)
            else:
                print("❌ You are already on the first page.")
                
        elif choice.startswith('page '):
            try:
                page_num = int(choice.split()[1]) - 1  # Convert to 0-based index
                if 0 <= page_num < total_pages:
                    current_page = page_num
                    display_file_page(audio_files, current_page, items_per_page)
                else:
                    print(f"❌ Invalid page number. Please enter a number between 1 and {total_pages}.")
            except (ValueError, IndexError):
                print("❌ Invalid page format. Use 'page X' where X is the page number.")
                
        elif choice.isdigit():
            file_idx = int(choice) - 1
            if 0 <= file_idx < len(audio_files):
                return os.path.join(COMMON_VOICE_PATH, audio_files[file_idx])
            else:
                print(f"❌ Invalid file number. Please enter a number between 1 and {len(audio_files)}.")
        
        else:
            print("❌ Invalid command. Please try again.")

def get_file_path():
    """Smart way to get the file path: GUI, list files, or manual input."""
    print("\nChoose an option to select an audio file:")
    print("1. Open file selection dialog (GUI)")
    print("2. Choose from Common Voice dataset")
    print("3. Manually enter file path")
    print("4. Quit")
    
    choice = input("Enter your choice (1/2/3/4): ").strip()

    if choice == "1":
        file_path = select_file()
        if file_path:
            return file_path
        return get_file_path()

    elif choice == "2":
        file_path = browse_common_voice_files()
        if file_path:
            return file_path
        if file_path == "quit":
            return "quit"
        return get_file_path()

    elif choice == "3":
        file_path = input("\nEnter the full path to the audio file (or 'back' to return): ").strip()
        if file_path.lower() == 'back':
            return get_file_path()
        if file_path.lower() == 'quit':
            return "quit"
        if os.path.isfile(file_path):
            return file_path
        else:
            print("❌ Error: File not found.")
            return get_file_path()
    
    elif choice == "4" or choice.lower() == "quit":
        return "quit"

    print("❌ Invalid option. Please try again.")
    return get_file_path()  # Restart file selection

def main():
    print("🎙️ Welcome to the OpenAI Whisper ASR Transcriber!")
    
    # Get model size from command line arguments if provided
    model_name = "base"
    if len(sys.argv) > 1:
        model_name = sys.argv[1]
        
    print(f"Using model: {model_name}")
    
    # Initialize transcriber with model size
    # Options include: "tiny", "base", "small", "medium", "large"
    try:
        transcriber = WhisperTranscriber(model_name)
    except Exception as e:
        print(f"Error initializing model: {e}")
        sys.exit(1)

    while True:
        file_path = get_file_path()

        if not file_path or file_path.lower() == "quit":
            print("🚪 Exiting... Goodbye!")
            break

        print(f"\n🔊 Playing: {file_path}")
        try:
            playsound(file_path)  # Play the audio file
        except Exception as e:
            print(f"Warning: Could not play audio ({e}). Continuing with transcription.")

        print("\n🎙️ Transcribing...")
        transcription = transcriber.transcribe(file_path)

        print("\n📜 Transcription:")
        print(transcription)

        print("\n✅ Done! Ready for next file.")

if __name__ == "__main__":
    main()
