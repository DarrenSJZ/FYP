import sys
import os
import warnings
import json
from vosk import Model, KaldiRecognizer
import wave
import numpy as np

# Import base transcriber and utilities
sys.path.append(os.path.join(os.path.dirname(__file__), '../../asr_utils'))
from base_transcriber import BaseTranscriber
from audio_utils import load_audio

class VoskTranscriber(BaseTranscriber):
    def __init__(self, model_path=None, rate=16000):
        if model_path is None:
            # Use default model path relative to this file
            model_path = os.path.join(os.path.dirname(__file__), "vosk-model-en-us-0.22")
        
        self.model_path = model_path
        if rate != 16000:
            raise ValueError("Vosk models only support a sampling rate of 16000 Hz.")
        super().__init__(model_name=model_path, rate=rate)

    def _initialize_model(self):
        print(f"Loading Vosk model: {self.model_name}...")
        if not os.path.exists(self.model_path):
            raise ValueError(f"No Vosk model found at {self.model_path}")
        try:
            self.model = Model(self.model_path)
            self.recognizer = KaldiRecognizer(self.model, self.rate)
            print("✅ Vosk model loaded successfully.")
        except Exception as e:
            raise RuntimeError(f"Failed to load Vosk model: {str(e)}")

    def transcribe(self, audio_file):
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                print("Loading and processing audio...")
                audio_data = load_audio(audio_file)
                
                # Convert to WAV format if needed
                if not audio_file.lower().endswith('.wav'):
                    temp_wav = "temp.wav"
                    # Convert float32 audio data to int16 before writing
                    audio_data_int16 = (audio_data * 32768.0).astype(np.int16)
                    with wave.open(temp_wav, 'wb') as wf:
                        wf.setnchannels(1)
                        wf.setsampwidth(2)
                        wf.setframerate(self.rate)
                        wf.writeframes(audio_data_int16.tobytes())
                    audio_file = temp_wav

                # Process the audio file
                print("Running speech recognition...")
                with wave.open(audio_file, 'rb') as wf:
                    chunk_size = 4000
                    while True:
                        data = wf.readframes(chunk_size)
                        if len(data) == 0:
                            break
                        if self.recognizer.AcceptWaveform(data):
                            result = json.loads(self.recognizer.Result())
                            if result.get("text"):
                                return result["text"]
                
                # Get final result
                result = json.loads(self.recognizer.FinalResult())
                return result.get("text", "")

        except Exception as e:
            return f"Error during transcription: {e}"
        finally:
            # Clean up temporary file if created
            if 'temp_wav' in locals() and os.path.exists(temp_wav):
                os.remove(temp_wav)

def main():
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        transcriber = VoskTranscriber()
        transcription = transcriber.transcribe(file_path)
        print(transcription)
    else:
        transcriber = VoskTranscriber()
        transcriber.run_interactive()

if __name__ == "__main__":
    main() 