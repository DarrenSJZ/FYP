import sys
import os
import warnings
import numpy as np
from collections import defaultdict
import tempfile # For creating temporary WAV files
import traceback # For detailed error printing
import subprocess # For running ffmpeg commands

# Import allosaurus
try:
    from allosaurus.app import read_recognizer
except ImportError:
    print("Error: Allosaurus not found. Please install it with 'pip install allosaurus'")
    sys.exit(1)

# Import soundfile for reading the converted WAV
try:
    import soundfile as sf
except ImportError:
    print("Error: soundfile not found. Please install it ('pip install soundfile')")
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
        # --- FIX: Set self.model_lang_id BEFORE super().__init__() ---
        self.model_lang_id = model_lang_id
        # --- END FIX ---

        super().__init__(model_name=model_lang_id) # Pass lang_id as model_name for BaseTranscriber's needs
        
        self.target_sr = 16000 # Common sample rate for ASR

        # CRITICAL: Define this based on Allosaurus output for your 'model_lang_id'
        # This is a generic placeholder. You MUST verify and update this set.
        # Run Allosaurus on sample audio for your target language and inspect its phoneme output.
        self.vowels = {
            'a', 'e', 'i', 'o', 'u', 'æ', 'ə', 'ɪ', 'ʊ', 'ɛ', 'ʌ', 'ɔ', 'ɑ', 'ɒ', 'ɨ', 'ʉ', 'ø', 'œ', 'ɶ', 'ɯ', 'ɤ', 'ɜ', 'ɞ', 'ʏ', 'ɐ', # Monophthongs
            'aː', 'eː', 'iː', 'oː', 'uː', 'əː', 'ɔː', 'ɛː', # Long vowels
            'ai', 'au', 'ei', 'oi', 'ou', # Common English-like diphthongs (check if Allosaurus outputs them as single units)
            'aɪ', 'aʊ', 'eɪ', 'ɔɪ', 'oʊ', 'əʊ' # More IPA diphthongs
        }
        self.linguistic_patterns = { # Example, expand as needed
            'malay': { # Use the actual lang_id Allosaurus uses for Malay (e.g., 'msa')
                'phonetic_syllable_patterns': [
                    ['l', 'a'], ['l', 'a', 'h'], ['a', 'h'], ['k', 'a', 'n'] # Example phonetic syllables for "la", "lah", "ah", "kan"
                ],
                'description': 'Common Malaysian expressions and particles (phonetic)'
            },
        }
        # _initialize_model() is called by super().__init__(), so no need to call it again here.

    def _initialize_model(self):
        print(f"Loading Allosaurus model for language ID: {self.model_lang_id}...")
        try:
            # First try with the specified language ID
            self.model = read_recognizer(self.model_lang_id)
            print(f"Successfully loaded Allosaurus model for language: {self.model_lang_id}")
        except Exception as e:
            print(f"Warning: Could not load Allosaurus model for '{self.model_lang_id}'. Error: {e}")
            print("Attempting to load default model with 'eng' language ID...")
            try:
                # Try loading the default model with 'eng' language ID
                self.model = read_recognizer()
                # Use 'eng' as the default language ID
                self.model_lang_id = 'eng'
                print(f"Successfully loaded default Allosaurus model with 'eng' language ID")
            except Exception as e2:
                print(f"Error: Failed to load default model. Error: {e2}")
                print("Please ensure you have a working internet connection and try again.")
                raise

    def process_audio_to_wav(self, input_audio_path):
        """
        Converts an audio file to WAV format using ffmpeg, ensuring it's mono and at the target sample rate.
        Returns the path to the temporary WAV file, or None on failure.
        """
        try:
            # Create a temporary WAV file path
            temp_dir = tempfile.gettempdir()
            # Sanitize filename for temp file
            base_name = os.path.basename(input_audio_path)
            sanitized_base_name = "".join(c if c.isalnum() or c in ('.', '_', '-') else '_' for c in base_name)
            temp_wav_path = os.path.join(temp_dir, f"allosaurus_input_{sanitized_base_name}.wav")
            
            # Use ffmpeg to convert to WAV with target sample rate and mono channel
            ffmpeg_cmd = [
                'ffmpeg', '-y',  # -y to overwrite output file if it exists
                '-i', input_audio_path,  # input file
                '-ac', '1',  # mono audio
                '-ar', str(self.target_sr),  # target sample rate
                '-acodec', 'pcm_s16le',  # 16-bit PCM
                temp_wav_path  # output file
            ]
            
            print(f"Running ffmpeg command: {' '.join(ffmpeg_cmd)}")
            result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                print(f"Error running ffmpeg: {result.stderr}")
                return None
                
            print(f"Successfully converted audio to WAV: {temp_wav_path}")
            return temp_wav_path
            
        except FileNotFoundError:
            print(f"Error: Audio file not found at {input_audio_path}")
            return None
        except Exception as e:
            print(f"Error processing audio file {input_audio_path} with ffmpeg: {e}")
            traceback.print_exc()
            return None

    def parse_allosaurus_output(self, phones_str):
        """ Parses the raw string output from Allosaurus into a list of timed phonemes. """
        timed_phonemes = []
        if not phones_str or phones_str.lower() == '<unk>':
            return timed_phonemes

        # Handle cases where output might not have '|' but still valid
        if '|' not in phones_str:
            parts = phones_str.strip().split()
            if len(parts) == 3:
                try:
                    phoneme, start_time, end_time = parts[0], float(parts[1]), float(parts[2])
                    if phoneme.lower() != 'sil':
                        timed_phonemes.append({'phoneme': phoneme, 'start': start_time, 'end': end_time})
                except ValueError:
                    print(f"Warning: Could not parse single segment: {phones_str}")
            elif len(parts) == 1 and parts[0].lower() != '<unk>':
                 print(f"Warning: Allosaurus output a single phoneme without timing: {parts[0]}")
            return timed_phonemes

        segments = phones_str.split('|')
        for seg in segments:
            parts = seg.strip().split()
            if len(parts) == 3:
                try:
                    phoneme, start_time, end_time = parts[0], float(parts[1]), float(parts[2])
                    if phoneme.lower() != 'sil': # Ignore silence
                        timed_phonemes.append({'phoneme': phoneme, 'start': start_time, 'end': end_time})
                except ValueError:
                    print(f"Warning: Could not parse segment: {seg}")
        return timed_phonemes

    def extract_syllables_with_timing(self, timed_phonemes):
        """
        Convert timed phonemes to syllables based on vowel detection, preserving timing.
        This is a simplified syllabifier. Real syllabification is more complex.
        """
        syllables_data = []
        if not timed_phonemes:
            return syllables_data

        current_syllable_phonemes_info = []
        for i, p_info in enumerate(timed_phonemes):
            current_syllable_phonemes_info.append(p_info)
            is_vowel = p_info['phoneme'].lower() in self.vowels # Ensure vowel set is accurate

            if is_vowel:
                is_last_phoneme = (i == len(timed_phonemes) - 1)
                end_syllable_here = is_last_phoneme # Default to end if last phoneme

                if not is_last_phoneme:
                    next_p_info = timed_phonemes[i+1]
                    next_is_consonant = next_p_info['phoneme'].lower() not in self.vowels
                    
                    # Basic rule: end syllable after a vowel if next is a consonant
                    if next_is_consonant:
                        end_syllable_here = True
                    # Add more sophisticated rules here if needed (e.g., for V.V sequences, complex onsets)

                if end_syllable_here and current_syllable_phonemes_info:
                    start_time = current_syllable_phonemes_info[0]['start']
                    # Use end time of the current phoneme (the vowel nucleus or last part of it)
                    # Or, if you want the syllable to include following consonants that form a coda,
                    # the logic needs to look further ahead. This basic one ends AT the vowel
                    # if the next is a consonant that starts a new syllable.
                    # For simplicity, this version makes the syllable end with its last phoneme.
                    end_time = current_syllable_phonemes_info[-1]['end'] 
                    phoneme_list = [p['phoneme'] for p in current_syllable_phonemes_info]
                    
                    syllables_data.append({
                        'phonemes': phoneme_list,
                        'text_representation': "".join(phoneme_list), # Simple concatenation
                        'start_time': start_time,
                        'end_time': end_time
                    })
                    current_syllable_phonemes_info = [] # Reset for next syllable

        # If any phonemes are left (e.g. a final coda not captured above, or if the loop ended)
        if current_syllable_phonemes_info:
            start_time = current_syllable_phonemes_info[0]['start']
            end_time = current_syllable_phonemes_info[-1]['end']
            phoneme_list = [p['phoneme'] for p in current_syllable_phonemes_info]
            syllables_data.append({
                'phonemes': phoneme_list,
                'text_representation': "".join(phoneme_list),
                'start_time': start_time,
                'end_time': end_time
            })
        return syllables_data

    def detect_linguistic_patterns(self, syllables_data):
        detected_patterns = defaultdict(int)
        pattern_details = defaultdict(list)
        # Match against your defined phonetic_syllable_patterns
        for lang_id_key, patterns_config in self.linguistic_patterns.items():
            # Ensure lang_id_key matches how you store patterns (e.g. 'msa' if Allosaurus lang_id is 'msa')
            if 'phonetic_syllable_patterns' in patterns_config:
                for syll_info in syllables_data:
                    current_syllable_phonemes_lower = [p.lower() for p in syll_info['phonemes']]
                    for pattern_phonemes in patterns_config['phonetic_syllable_patterns']:
                        # Simple exact match of the syllable's phonemes
                        if current_syllable_phonemes_lower == pattern_phonemes:
                            pattern_str = "".join(pattern_phonemes)
                            detected_patterns[lang_id_key] += 1
                            pattern_details[lang_id_key].append({
                                'expression': pattern_str, # This is the phonetic pattern
                                'description': patterns_config['description']
                            })
        return {
            'patterns': dict(detected_patterns),
            'details': dict(pattern_details)
        }

    def transcribe(self, audio_file_path):
        processed_audio_path_for_allosaurus = None 
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", category=UserWarning)
                warnings.simplefilter("ignore", category=FutureWarning)

                print(f"Processing audio file: {audio_file_path}")
                processed_audio_path_for_allosaurus = self.process_audio_to_wav(audio_file_path)

                if not processed_audio_path_for_allosaurus:
                    return f"Failed to process audio file: {audio_file_path}"

                print(f"Running Allosaurus on: {processed_audio_path_for_allosaurus}")
                phones_str = self.model.recognize(processed_audio_path_for_allosaurus, lang_id=self.model_lang_id, emit=1.0)
                
                timed_phonemes = self.parse_allosaurus_output(phones_str)
                if not timed_phonemes and phones_str and phones_str.lower() != "<unk>":
                    print(f"Warning: No timed phonemes extracted though Allosaurus output was: {phones_str}")
                elif not timed_phonemes:
                     print(f"Warning: No phonemes extracted by Allosaurus or parsing failed. Raw output: {phones_str}")


                syllables_data = self.extract_syllables_with_timing(timed_phonemes)
                patterns = self.detect_linguistic_patterns(syllables_data)
                
                return {
                    "syllables_data": syllables_data,
                    "timed_phonemes": timed_phonemes,
                    "linguistic_patterns": patterns,
                    "raw_allosaurus_output": phones_str
                }

        except FileNotFoundError:
            return f"Error: The file {audio_file_path} was not found."
        except Exception as e:
            traceback.print_exc()
            return f"An unexpected error occurred in transcribe method: {e}"
        finally:
            if processed_audio_path_for_allosaurus and os.path.exists(processed_audio_path_for_allosaurus):
                try:
                    os.remove(processed_audio_path_for_allosaurus)
                    print(f"Removed temporary WAV file: {processed_audio_path_for_allosaurus}")
                except OSError as e_remove:
                    print(f"Error removing temporary WAV file {processed_audio_path_for_allosaurus}: {e_remove}")

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