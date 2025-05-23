import sys
import os
import warnings
from tqdm import tqdm
import deepspeech

# Import base transcriber and utilities
sys.path.append(os.path.join(os.path.dirname(__file__), '../../asr_utils'))
from base_transcriber import BaseTranscriber
from audio_utils import load_audio, convert_to_int16

class DeepSpeechTranscriber(BaseTranscriber):
    def __init__(self, model_path="/home/laughdiemeh/FYP_HERE_WE_FKN_GO/src/asr_models/deepspeech/DeepSpeech-0.9.3/deepspeech-0.9.3-models.pbmm", scorer_path="/home/laughdiemeh/FYP_HERE_WE_FKN_GO/src/asr_models/deepspeech/DeepSpeech-0.9.3/deepspeech-0.9.3-models.scorer", rate=16000):
        self.model_path = model_path
        self.scorer_path = scorer_path
        if rate != 16000:
            raise ValueError("DeepSpeech models only support a sampling rate of 16000 Hz.")
        super().__init__(model_name=model_path, rate=rate)

    def _initialize_model(self):
        print(f"Loading DeepSpeech model: {self.model_name}...")
        self.model = deepspeech.Model(self.model_path)
        if self.scorer_path and os.path.exists(self.scorer_path):
            self.model.enableExternalScorer(self.scorer_path)
        print("DeepSpeech model loaded.")

    def transcribe(self, audio_file):
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                print("Loading and processing audio...")
                audio_data = load_audio(audio_file)
                # Convert to int16 for DeepSpeech
                audio_data = convert_to_int16(audio_data)
                print("Running speech recognition...")
                for _ in tqdm(range(10), desc="Recognizing speech"):
                    pass
                text = self.model.stt(audio_data)
                return text
        except Exception as e:
            return f"Error during transcription: {e}"

def main():
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        transcriber = DeepSpeechTranscriber()
        transcription = transcriber.transcribe(file_path)
        print(transcription)
    else:
        transcriber = DeepSpeechTranscriber()
        transcriber.run_interactive()

if __name__ == "__main__":
    main()
