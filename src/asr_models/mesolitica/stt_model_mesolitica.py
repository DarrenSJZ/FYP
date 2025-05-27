import sys
import os
import warnings
import torch
from transformers.models.wav2vec2 import Wav2Vec2Processor, Wav2Vec2ForCTC

# Import base transcriber and utilities
sys.path.append(os.path.join(os.path.dirname(__file__), '../../asr_utils'))
from base_transcriber import BaseTranscriber
from audio_utils import load_audio, get_device

class MesoliticaTranscriber(BaseTranscriber):
    def __init__(self, model_name="mesolitica/wav2vec2-xls-r-300m-mixed", rate=16000):
        if rate != 16000:
            raise ValueError("Mesolitica models only support a sampling rate of 16000 Hz.")
        super().__init__(model_name=model_name, rate=rate)

    def _initialize_model(self):
        print(f"Loading Mesolitica Wav2Vec2 model: {self.model_name}...")
        self.processor = Wav2Vec2Processor.from_pretrained(self.model_name)
        self.model = Wav2Vec2ForCTC.from_pretrained(self.model_name).eval()
        self.device = get_device()
        if torch.cuda.is_available():
            self.model = self.model.to(self.device)
        print(f"Using device: {self.device}")

    def transcribe(self, audio_file):
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                print("Loading and processing audio...")
                audio = load_audio(audio_file)
                inputs = self.processor(audio, sampling_rate=16000, return_tensors="pt", padding=True)
                if torch.cuda.is_available():
                    inputs = {k: v.to(self.device) for k, v in inputs.items()}
                with torch.no_grad():
                    logits = self.model(**inputs).logits
                pred_ids = torch.argmax(logits, dim=-1)
                text = self.processor.batch_decode(pred_ids, skip_special_tokens=True)[0]
                return text
        except Exception as e:
            return f"Error during transcription: {e}"

def main():
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        transcriber = MesoliticaTranscriber()
        transcription = transcriber.transcribe(file_path)
        print(transcription)
    else:
        transcriber = MesoliticaTranscriber()
        transcriber.run_interactive()

if __name__ == "__main__":
    main()
