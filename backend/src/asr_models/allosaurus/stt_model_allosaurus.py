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
        # Look for lines that contain IPA characters (comprehensive set)
        ipa_symbols = (
            # Vowels (from your IPA chart)
            r'iyɨʉɯuɪʏʊeøɘɵɤoɛœɜɞʌɔæɐɑɒəɶ'
            # Consonants (pulmonic)
            r'pbmɸβfvʋθðtdnszɾɹlʃʒɻʈɖɳʂʐɽɭcɟɲçʝjkɡŋxɣɰqɢɴχʁħʕʔhɦ'
            # Non-pulmonic consonants
            r'pʼtʼkʼsʼɓɗʄɠʛʘǀǃǂǁ'
            # Common diacritics and suprasegmentals
            r'ʰʲʷ˞ːˑˈˌ'
            # Other common symbols
            r'͡'
        )
        ipa_pattern = re.compile(f'[{ipa_symbols}]')
        for line in reversed(lines):
            if ipa_pattern.search(line):
                return line
                
        # If no IPA pattern found, return the last line
        return lines[-1]

    def group_phonemes_into_words(self, timed_phonemes):
        """
        Group phonemes into words using sophisticated statistical gap analysis
        """
        if not timed_phonemes or len(timed_phonemes) < 2:
            return []
        
        # Calculate all gaps between consecutive phonemes
        gaps = []
        gap_positions = []
        for i in range(1, len(timed_phonemes)):
            gap = timed_phonemes[i]['start_time'] - timed_phonemes[i-1]['end_time']
            gaps.append(gap)
            gap_positions.append(i-1)  # Position after which the gap occurs
        
        if not gaps:
            return []
        
        # Statistical analysis of gaps
        import statistics
        
        gaps_mean = statistics.mean(gaps)
        gaps_median = statistics.median(gaps)
        gaps_stdev = statistics.stdev(gaps) if len(gaps) > 1 else 0
        
        print(f"Gap Analysis: mean={gaps_mean:.3f}, median={gaps_median:.3f}, stdev={gaps_stdev:.3f}")
        
        # Moving average analysis with window size 3
        window_size = min(3, len(gaps))
        moving_averages = []
        
        for i in range(len(gaps)):
            # Calculate moving average centered around position i
            start_idx = max(0, i - window_size // 2)
            end_idx = min(len(gaps), i + window_size // 2 + 1)
            local_gaps = gaps[start_idx:end_idx]
            moving_avg = sum(local_gaps) / len(local_gaps)
            moving_averages.append(moving_avg)
        
        # Spike detection: find gaps that are significantly larger than local context
        word_boundaries = []
        
        for i, gap in enumerate(gaps):
            local_avg = moving_averages[i]
            
            # Multiple criteria for word boundary detection:
            is_boundary = False
            
            # Criterion 1: Gap is significantly larger than local moving average
            if gap > local_avg + 1.5 * gaps_stdev and gap > 0.03:
                is_boundary = True
                print(f"Boundary detected (spike): gap={gap:.3f} > local_avg={local_avg:.3f} + 1.5*stdev at position {i}")
            
            # Criterion 2: Gap is an outlier (>2 standard deviations from mean)
            elif gap > gaps_mean + 2 * gaps_stdev and gap > 0.05:
                is_boundary = True
                print(f"Boundary detected (outlier): gap={gap:.3f} > mean + 2*stdev at position {i}")
            
            # Criterion 3: Very large gap (absolute threshold for obvious pauses)
            elif gap > 0.15:
                is_boundary = True
                print(f"Boundary detected (large gap): gap={gap:.3f} > 0.15s at position {i}")
            
            # Criterion 4: Adaptive threshold based on gap distribution percentiles
            elif len(gaps) >= 5:
                # Calculate 75th percentile as dynamic threshold
                gaps_sorted = sorted(gaps)
                percentile_75 = gaps_sorted[int(0.75 * len(gaps_sorted))]
                if gap > percentile_75 * 1.8 and gap > 0.04:
                    is_boundary = True
                    print(f"Boundary detected (percentile): gap={gap:.3f} > 75th_percentile * 1.8 at position {i}")
            
            if is_boundary:
                word_boundaries.append(gap_positions[i])
        
        # Group phonemes into words based on detected boundaries
        words = []
        current_word = []
        
        for i, phoneme in enumerate(timed_phonemes):
            current_word.append(phoneme)
            
            # Check if this position is a word boundary
            if i in word_boundaries or i == len(timed_phonemes) - 1:  # Last phoneme is always boundary
                if current_word:
                    word_info = {
                        'phonemes': [p['phoneme'] for p in current_word],
                        'start_time': current_word[0]['start_time'],
                        'end_time': current_word[-1]['end_time'],
                        'duration': current_word[-1]['end_time'] - current_word[0]['start_time'],
                        'phoneme_count': len(current_word),
                        'boundary_type': 'detected' if i in word_boundaries else 'final'
                    }
                    words.append(word_info)
                    current_word = []
        
        print(f"Detected {len(word_boundaries)} word boundaries, created {len(words)} word groups")
        return words

    def detect_particles_mathematically(self, phoneme_words, timed_phonemes):
        """
        Detect cultural particles using mathematical analysis of phoneme groups
        """
        # Particle registry with phoneme patterns
        PARTICLE_REGISTRY = {
            'la': {'phonemes': ['l', 'a'], 'culture': 'Malaysian/Singaporean'},
            'lor': {'phonemes': ['l', 'ɔ', 'r'], 'culture': 'Malaysian/Singaporean'},
            'ah': {'phonemes': ['ɑ'], 'culture': 'Malaysian/Singaporean'},
            'meh': {'phonemes': ['m', 'ɛ'], 'culture': 'Cantonese'},
            'ja': {'phonemes': ['j', 'a'], 'culture': 'German'},
            'na': {'phonemes': ['n', 'a'], 'culture': 'Indian English'},
            'wah': {'phonemes': ['w', 'ɑ'], 'culture': 'Malaysian/Singaporean'},
            'aiya': {'phonemes': ['aɪ', 'j', 'a'], 'culture': 'Chinese'}
        }
        
        detected_particles = []
        
        for word in phoneme_words:
            word_phonemes = word['phonemes']
            
            # Check each particle pattern
            for particle_name, particle_info in PARTICLE_REGISTRY.items():
                particle_phonemes = particle_info['phonemes']
                
                # Exact match check
                if word_phonemes == particle_phonemes:
                    # Calculate confidence score
                    confidence_score = 0
                    
                    # Duration score: particles are usually brief
                    if word['duration'] < 0.3:  # Less than 300ms
                        confidence_score += 3
                    elif word['duration'] < 0.5:  # Less than 500ms
                        confidence_score += 1
                    
                    # Phoneme count score: particles are usually short
                    if word['phoneme_count'] <= 2:
                        confidence_score += 2
                    elif word['phoneme_count'] == 3:
                        confidence_score += 1
                    
                    # Standalone score: check gaps before/after
                    word_index = phoneme_words.index(word)
                    
                    # Gap before
                    if word_index > 0:
                        prev_word = phoneme_words[word_index - 1]
                        gap_before = word['start_time'] - prev_word['end_time']
                        if gap_before > 0.05:
                            confidence_score += 2
                        elif gap_before > 0.02:
                            confidence_score += 1
                    
                    # Gap after
                    if word_index < len(phoneme_words) - 1:
                        next_word = phoneme_words[word_index + 1]
                        gap_after = next_word['start_time'] - word['end_time']
                        if gap_after > 0.05:
                            confidence_score += 2
                        elif gap_after > 0.02:
                            confidence_score += 1
                    
                    # High confidence threshold
                    if confidence_score >= 5:
                        detected_particles.append({
                            'particle': particle_name,
                            'phonemes': word_phonemes,
                            'culture': particle_info['culture'],
                            'start_time': word['start_time'],
                            'end_time': word['end_time'],
                            'confidence_score': confidence_score,
                            'word_index': word_index
                        })
        
        return detected_particles

    def transcribe(self, audio_file_path):
        processed_audio_path = None
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                
                # Convert audio to WAV format
                processed_audio_path = self.process_audio_to_wav(audio_file_path)
                if not processed_audio_path:
                    return "Error: Failed to process audio file"

                # Run Allosaurus WITHOUT timing first (for compatibility)
                phonemes_no_time = self.model.recognize(processed_audio_path, self.model_lang_id)
                clean_phonemes_basic = self.clean_transcription(phonemes_no_time)
                
                # Run Allosaurus WITH timing information
                phonemes_with_time_raw = self.model.recognize(processed_audio_path, self.model_lang_id, timestamp=True)
                
                # Parse timing information
                timed_phonemes = []
                phonemes_only = []
                
                for line in phonemes_with_time_raw.strip().split('\n'):
                    line = line.strip()
                    if not line:
                        continue
                    parts = line.split()
                    if len(parts) >= 3:
                        start_time = float(parts[0])
                        duration = float(parts[1]) 
                        phoneme = parts[2]
                        end_time = start_time + duration
                        timed_phonemes.append({
                            'phoneme': phoneme,
                            'start_time': start_time,
                            'duration': duration,
                            'end_time': end_time
                        })
                        phonemes_only.append(phoneme)
                
                # Group phonemes into words using timing analysis
                phoneme_words = self.group_phonemes_into_words(timed_phonemes)
                
                # Detect particles using mathematical approach
                detected_particles = self.detect_particles_mathematically(phoneme_words, timed_phonemes)
                
                # Clean up temporary file
                if os.path.exists(processed_audio_path):
                    os.remove(processed_audio_path)
                
                # Return structured data with both versions
                result = {
                    'transcription': clean_phonemes_basic,  # Non-timed version for compatibility
                    'transcription_timed': ' '.join(phonemes_only),  # Timed version phonemes
                    'timed_phonemes': timed_phonemes,  # Detailed timing data
                    'phoneme_words': phoneme_words,  # Grouped phonemes into words
                    'detected_particles': detected_particles,  # Mathematically detected particles
                    'raw_output': phonemes_with_time_raw,
                    'raw_output_no_time': phonemes_no_time
                }
                
                return result

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
                print("\n--- Phoneme Transcription with Timing ---")
                timed_ph = result.get("timed_phonemes")
                if timed_ph:
                    for i, p_info in enumerate(timed_ph, 1):
                        print(f"{i}. {p_info['phoneme']} ({p_info['start_time']:.2f}s - {p_info['end_time']:.2f}s)")
                else:
                    print("No timed phonemes found or parsed.")
                
                print("\n--- Grouped Phoneme Words ---")
                phoneme_words = result.get("phoneme_words", [])
                if phoneme_words:
                    for i, word in enumerate(phoneme_words, 1):
                        phoneme_str = " ".join(word['phonemes'])
                        print(f"{i}. [{phoneme_str}] ({word['start_time']:.2f}s - {word['end_time']:.2f}s, {word['duration']:.2f}s duration)")
                else:
                    print("No phoneme words found.")
                
                print("\n--- Detected Particles ---")
                detected_particles = result.get("detected_particles", [])
                if detected_particles:
                    for i, particle in enumerate(detected_particles, 1):
                        phoneme_str = " ".join(particle['phonemes'])
                        print(f"{i}. '{particle['particle']}' [{phoneme_str}] - {particle['culture']} (confidence: {particle['confidence_score']}, {particle['start_time']:.2f}s - {particle['end_time']:.2f}s)")
                else:
                    print("No particles detected.")
            else:
                print(f"Error or Info: {result}")
            print("-" * 50)

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