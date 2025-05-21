import os
import uuid
import tempfile
import numpy as np
from pydub import AudioSegment
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client

from storage import get_signed_url, download_and_process_gcs_audio, run_in_model_env

# ─── Load environment ─────────────────────────────────────────────────────────
load_dotenv()  # picks up SUPABASE_URL and SUPABASE_KEY from .env

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in your environment")

# ─── Supabase client ──────────────────────────────────────────────────────────
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "MCP FastAPI Service is running"}

@app.get("/clip/{clip_id}")
async def get_clip_data(clip_id: uuid.UUID):
    """
    Retrieves clip metadata and returns a time-limited signed GCS URL for streaming.
    """
    # 1) Fetch clip + dataset info from Supabase
    resp = (
        supabase
        .table("clips")
        .select("""
            id,
            sentence,
            gcs_filename,
            dataset:datasets (
                gcs_bucket_name,
                gcs_base_path
            )
        """)
        .eq("id", str(clip_id))
        .single()
        .execute()
    )

    clip = resp.data
    if not clip or not clip.get("dataset"):
        raise HTTPException(status_code=404, detail="Clip not found or dataset info missing")

    # 2) Build the object path and sign it
    ds = clip["dataset"]
    bucket = ds["gcs_bucket_name"].strip("/")
    base = ds["gcs_base_path"].strip("/")
    name = clip["gcs_filename"].strip("/")
    object_path = f"{base}/{name}" if base else name

    try:
        url = get_signed_url(bucket, object_path, expiration=3600)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error signing URL: {e}")

    # 3) Return metadata + signed URL
    return {
        "clip_id": str(clip["id"]),
        "sentence": clip["sentence"],
        "audio_url": url,
        "gcs_object_path_in_bucket": object_path
    }

@app.post("/transcribe/{clip_id}")
async def transcribe_clip(clip_id: uuid.UUID, model: str = "wav2vec"):
    """
    Transcribes a clip using the specified ASR model.
    
    Args:
        clip_id: UUID of the clip to transcribe
        model: ASR model to use (wav2vec, whisper, deepspeech, moonshine)
    """
    # 1) Get the clip data and signed URL
    clip_data = await get_clip_data(clip_id)
    audio_url = clip_data["audio_url"]
    
    try:
        # 2) Download and process the audio
        audio_data, sample_rate = download_and_process_gcs_audio(audio_url)
        
        # 3) Save the processed audio to a temporary file
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            # Convert numpy array back to audio segment
            audio = AudioSegment(
                audio_data.tobytes(),
                frame_rate=sample_rate,
                sample_width=2,
                channels=1
            )
            audio.export(temp_file.name, format="wav")
            temp_path = temp_file.name
        
        try:
            # 4) Run transcription in the appropriate virtual environment
            model_script = os.path.join(
                os.path.dirname(__file__),
                "asr_models",
                model.lower(),
                f"stt_model_{model.lower()}.py"
            )
            
            transcription = run_in_model_env(model, model_script, temp_path)
            
            return {
                "clip_id": str(clip_id),
                "model": model,
                "transcription": transcription,
                "reference": clip_data["sentence"]
            }
            
        finally:
            # Clean up the temporary file
            os.unlink(temp_path)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during transcription: {e}")
