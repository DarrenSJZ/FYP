import sys
import os
import warnings
from tqdm import tqdm
import torch
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

# Import base transcriber and utilities
sys.path.append(os.path.join(os.path.dirname(__file__), '../../asr_utils'))
from base_transcriber import BaseTranscriber
from audio_utils import load_audio, get_device

class Wav2VecTranscriber(BaseTranscriber):
    def __init__(self, model_name="facebook/wav2vec2-base-960h", rate=16000):
        if rate != 16000:
            raise ValueError("Wav2Vec 2.0 models only support a sampling rate of 16000 Hz.")
        super().__init__(model_name=model_name, rate=rate)

    def _initialize_model(self):
        print(f"Loading Wav2Vec 2.0 model: {self.model_name}...")
        self.processor = Wav2Vec2Processor.from_pretrained(self.model_name)
        self.model = Wav2Vec2ForCTC.from_pretrained(self.model_name)
        self.device = get_device()
        self.model = self.model.to(self.device)
        print(f"Using device: {self.device}")

    def transcribe(self, audio_file):
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                print("Loading and processing audio...")
                audio_data = load_audio(audio_file)
                print("Running speech recognition...")
                for _ in tqdm(range(10), desc="Recognizing speech"):
                    pass
                inputs = self.processor(audio_data, sampling_rate=16000, return_tensors="pt")
                input_values = inputs.input_values.to(self.device)
                with torch.no_grad():
                    logits = self.model(input_values).logits
                predicted_ids = torch.argmax(logits, dim=-1)
                transcription = self.processor.batch_decode(predicted_ids)[0]
                return transcription
        except Exception as e:
            return f"Error during transcription: {e}"

def main():
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        transcriber = Wav2VecTranscriber()
        transcription = transcriber.transcribe(file_path)
        print(transcription)
    else:
        transcriber = Wav2VecTranscriber()
        transcriber.run_interactive()

if __name__ == "__main__":
    main()