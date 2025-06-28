import sys
import os
import warnings
import numpy as np
from collections import defaultdict
import tempfile # For creating temporary WAV files
import traceback # For detailed error printing
import subprocess # For running ffmpeg commands
import re

# Import allosaurus
try:
    from allosaurus.app import read_recognizer
except ImportError:
    print("Error: Allosaurus not found. Please install it with 'uv pip install allosaurus'")
    sys.exit(1)

# Import soundfile for reading the converted WAV
try:
    import soundfile as sf
except ImportError:
    print("Error: soundfile not found. Please install it ('uv pip install soundfile')")
    sys.exit(1)


# Import base transcriber and utilities
script_dir = os.path.dirname(os.path.abspath(__file__))
# Assuming asr_utils is two levels up from this script's directory
# e.g., project_root/src/asr_utils and project_root/src/asr_models/allosaurus/
asr_utils_path = os.path.realpath(os.path.join(script_dir, '..', '..', 'asr_utils'))
if asr_utils_path not in sys.path:
    sys.path.append(asr_utils_path)

try:
    from base_transcriber import BaseTranscriber
    # from audio_utils import get_device # Allosaurus runs on CPU; device might not be relevant for it
except ImportError:
    print(f"Error: Could not import from asr_utils. Looked in: {asr_utils_path}")
    print("Please ensure base_transcriber.py is in the asr_utils directory and the path is correct.")
    sys.exit(1)

class AllosaurusTranscriber(BaseTranscriber):
    def __init__(self, model_lang_id="eng"):
        self.model_lang_id = model_lang_id
        super().__init__(model_name=model_lang_id)
        self.target_sr = 16000

    def _initialize_model(self):
        try:
            self.model = read_recognizer()
            print("Successfully loaded Allosaurus model")
        except Exception as e:
            raise RuntimeError(f"Failed to load Allosaurus model: {str(e)}")

    def process_audio_to_wav(self, input_audio_path):
        """Converts an audio file to WAV format using ffmpeg"""
        try:
            temp_dir = tempfile.gettempdir()
            base_name = os.path.basename(input_audio_path)
            sanitized_base_name = "".join(c if c.isalnum() or c in ('.', '_', '-') else '_' for c in base_name)
            temp_wav_path = os.path.join(temp_dir, f"allosaurus_input_{sanitized_base_name}.wav")
            
            ffmpeg_cmd = [
                'ffmpeg', '-y',
                '-i', input_audio_path,
                '-ac', '1',
                '-ar', str(self.target_sr),
                '-acodec', 'pcm_s16le',
                temp_wav_path
            ]
            
            result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                raise RuntimeError(f"Error running ffmpeg: {result.stderr}")
                
            return temp_wav_path
            
        except Exception as e:
            raise RuntimeError(f"Error processing audio file: {str(e)}")

    @staticmethod
    def clean_transcription(text):
        """Clean up transcription output by removing setup messages and keeping only the actual transcription"""
        # Split by newlines and get the last non-empty line
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        if not lines:
            return text
            
        # For Allosaurus, we want the last line that contains phonemes
        # Look for lines that contain IPA characters
        ipa_pattern = re.compile(r'[a-zæəɪʊɛʌɔɑɒɨʉøœɶɯɤɜɞʏɐːɪʊɛːɔːɪʊeɪɔɪoʊəʊ]')
        for line in reversed(lines):
            if ipa_pattern.search(line):
                return line
                
        # If no IPA pattern found, return the last line
        return lines[-1]

    def transcribe(self, audio_file_path):
        processed_audio_path = None
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                
                # Convert audio to WAV format
                processed_audio_path = self.process_audio_to_wav(audio_file_path)
                if not processed_audio_path:
                    return "Error: Failed to process audio file"

                # Run Allosaurus directly on the WAV file
                phonemes = self.model.recognize(processed_audio_path, self.model_lang_id)
                
                # Clean up temporary file
                if os.path.exists(processed_audio_path):
                    os.remove(processed_audio_path)
                
                # Clean and return just the phonemes
                return self.clean_transcription(phonemes)

        except Exception as e:
            if processed_audio_path and os.path.exists(processed_audio_path):
                os.remove(processed_audio_path)
            return f"Error during transcription: {str(e)}"

    def run_interactive(self):
        print("Interactive mode. Type 'exit' to quit.")
        while True:
            audio_file = input(f"Enter the path to the audio file (current lang: {self.model_lang_id}): ").strip()
            if audio_file.lower() == 'exit':
                break
            if not os.path.exists(audio_file):
                print(f"File not found: {audio_file}")
                continue
            result = self.transcribe(audio_file)
            if isinstance(result, dict):
                print("\n--- Allosaurus Output ---")
                print(f"Raw: {result.get('raw_allosaurus_output', 'N/A')}")

                print("\n--- Timed Phonemes ---")
                timed_ph = result.get("timed_phonemes")
                if timed_ph:
                    for i, p_info in enumerate(timed_ph, 1):
                        print(f"{i}. {p_info['phoneme']} ({p_info['start']:.2f}s - {p_info['end']:.2f}s)")
                else:
                    print("No timed phonemes found or parsed.")
                
                print("\n--- Detected Syllables ---")
                syll_data = result.get("syllables_data")
                if syll_data:
                    for i, syll_info in enumerate(syll_data, 1):
                        phonemes_str = " ".join(syll_info['phonemes'])
                        print(f"{i}. [{phonemes_str}] ({syll_info['start_time']:.2f}s - {syll_info['end_time']:.2f}s) (Text: {syll_info['text_representation']})")
                else:
                    print("No syllables found.")

                print("\n--- Detected Linguistic Patterns ---")
                lp = result.get("linguistic_patterns")
                if lp and lp.get("patterns"):
                    if lp["patterns"]:
                        for lang, count in lp["patterns"].items():
                            print(f"\n{lang.upper()} (Count: {count}):")
                            if lang in lp["details"]:
                                for detail in lp["details"][lang]:
                                    print(f"  - Pattern: '{detail['expression']}' ({detail['description']})")
                    else:
                        print("No specific linguistic patterns detected.")
                else:
                    print("Linguistic pattern data not available or no patterns found.")
            else:
                print(f"Error or Info: {result}")
            print("-" * 30)

def main():
    model_lang_id_arg = "eng" 
    
    args = sys.argv[1:] # Get all arguments after script name
    file_path_arg = None

    if args:
        # Check if the first argument is a likely language ID (e.g., 3 chars, not a path)
        # This is a heuristic, might need refinement
        if len(args[0]) <= 3 and not os.path.sep in args[0] and not args[0].endswith(('.wav', '.mp3', '.flac')):
            model_lang_id_arg = args[0]
            if len(args) > 1:
                file_path_arg = args[1]
        else:
            file_path_arg = args[0]

    print(f"Using Allosaurus language ID: {model_lang_id_arg}")
    transcriber = AllosaurusTranscriber(model_lang_id=model_lang_id_arg)
    
    if file_path_arg:
        if not os.path.exists(file_path_arg):
            print(f"Error: File not found: {file_path_arg}")
            sys.exit(1)
        result = transcriber.transcribe(file_path_arg)
        if isinstance(result, dict):
            print(f"\nResults for {file_path_arg}:")
            print(f"Raw Allosaurus Output: {result.get('raw_allosaurus_output', 'N/A')}")
            # More detailed printing can be added here if desired for CLI output
            print("\nSyllables Data (first 5 or all):")
            for i, s in enumerate(result.get("syllables_data", [])):
                if i < 5: print(s)
                elif i == 5: print("...")
            # print("\nLinguistic Patterns:")
            # print(result.get("linguistic_patterns"))
        else:
            print(result)
    else:
        transcriber.run_interactive()

if __name__ == "__main__":
    main()