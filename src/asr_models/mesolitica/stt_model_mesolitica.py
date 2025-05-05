import os
import numpy as np
import torch
import torchaudio
from playsound3 import playsound  # :contentReference[oaicite:0]{index=0}
from transformers.models.wav2vec2 import Wav2Vec2Processor, Wav2Vec2ForCTC

COMMON_VOICE_PATH = os.path.expanduser(
    "~/common_voice_datasets/cv-corpus-17.0-delta-2024-03-15/en/clips/"
)

def list_audio_files(directory: str) -> list[str]:
    files = []
    for f in os.listdir(directory):
        lower = f.lower()
        if lower.endswith(".wav") or lower.endswith(".mp3"):
            files.append(f)
    files.sort()
    return files

def display_file_page(
    audio_files: list[str], page: int = 0, per_page: int = 20
) -> int:
    total = len(audio_files)
    pages = (total + per_page - 1) // per_page
    start = page * per_page
    end = min(start + per_page, total)

    print(f"\nShowing files {start+1}-{end} of {total} (Page {page+1}/{pages})")
    for idx, fn in enumerate(audio_files[start:end], start + 1):
        print(f"{idx}. {fn}")
    print("Commands: number to select, next, prev, page X, back, quit")
    return pages

def browse_common_voice_files() -> str | None:
    if not os.path.isdir(COMMON_VOICE_PATH):
        print(f"Error: directory not found: {COMMON_VOICE_PATH}")
        return None

    files = list_audio_files(COMMON_VOICE_PATH)
    if not files:
        print("Error: no audio files found.")
        return None

    page = 0
    pages = display_file_page(files, page)
    while True:
        choice = input("Enter selection: ").strip().lower()
        if choice in ("quit", "exit"):
            return "quit"
        if choice == "back":
            return None
        if choice == "next":
            if page < pages - 1:
                page += 1
                display_file_page(files, page)
            else:
                print("Already on last page.")
            continue
        if choice == "prev":
            if page > 0:
                page -= 1
                display_file_page(files, page)
            else:
                print("Already on first page.")
            continue
        if choice.startswith("page "):
            parts = choice.split()
            if len(parts) == 2 and parts[1].isdigit():
                p = int(parts[1]) - 1
                if 0 <= p < pages:
                    page = p
                    display_file_page(files, page)
                else:
                    print(f"Invalid page number (1–{pages})")
            else:
                print("Invalid 'page X' format")
            continue
        if choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(files):
                return os.path.join(COMMON_VOICE_PATH, files[idx])
            print("Invalid file number.")
            continue

        print("Invalid command.")

def get_file_path() -> str | None:
    print("\n1) Browse Common Voice dataset")
    print("2) Manually enter file path")
    print("3) Quit")
    choice = input("Choice: ").strip()

    if choice == "1":
        path = browse_common_voice_files()
        if path in (None, "quit"):
            return path
        return path

    if choice == "2":
        p = input("Enter full path (or 'back'): ").strip()
        if p.lower() == "back":
            return get_file_path()
        if p.lower() in ("quit", "exit"):
            return "quit"
        if os.path.isfile(p):
            return p
        print("File not found.")
        return get_file_path()

    if choice in ("3", "quit", "exit"):
        return "quit"

    print("Invalid option.")
    return get_file_path()

def load_audio(path: str) -> np.ndarray:
    waveform, sr = torchaudio.load(path)
    mono = waveform.mean(dim=0)
    if sr != 16000:
        mono = torchaudio.functional.resample(mono, sr, 16000)
    return mono.numpy()

def main() -> None:
    print("🎙️ Mesolitica Wav2Vec2 Transcriber")

    # Load processor & model
    processor = Wav2Vec2Processor.from_pretrained(
        "mesolitica/wav2vec2-xls-r-300m-mixed"
    )
    model = Wav2Vec2ForCTC.from_pretrained(
        "mesolitica/wav2vec2-xls-r-300m-mixed"
    ).eval()
    if torch.cuda.is_available():
        model.to("cuda")

    while True:
        path = get_file_path()
        if not path or path == "quit":
            print("🚪 Exiting…")
            break

        print(f"\n▶ Playing: {path}")
        try:
            playsound(path)
        except Exception as e:
            print(f"⚠️ Playback failed ({e}), continuing…")

        print("▶ Transcribing…")
        audio = load_audio(path)

        inputs = processor(
            audio,
            sampling_rate=16000,
            return_tensors="pt",
            padding=True
        )
        if torch.cuda.is_available():
            inputs = {k: v.to("cuda") for k, v in inputs.items()}

        with torch.no_grad():
            logits = model(**inputs).logits

        pred_ids = torch.argmax(logits, dim=-1)
        text = processor.batch_decode(pred_ids, skip_special_tokens=True)[0]

        print("\n📜", text)
        # immediately loop back to file-selection without any extra prompt

if __name__ == "__main__":
    main()
