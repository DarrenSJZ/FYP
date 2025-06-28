#!/usr/bin/env python3
"""
Allosaurus ASR HTTP Service
Self-contained FastAPI service for Allosaurus phoneme recognition
"""
import os
import sys
import time
import warnings
import tempfile
import subprocess
import re
import uvicorn
from fastapi import HTTPException, UploadFile, File

# Add parent directories to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))

from asr_utils.service_utils import (
    create_fastapi_app, validate_audio_file, save_temp_file, cleanup_temp_file,
    create_health_response, create_transcription_response
)

# Import Allosaurus
try:
    from allosaurus.app import read_recognizer
except ImportError:
    print("Error: Allosaurus not found. Please install it with 'uv pip install allosaurus'")
    sys.exit(1)

# Create FastAPI app
app = create_fastapi_app("Allosaurus ASR Service")

# Global service state
allosaurus_model = None
model_ready = False
start_time = time.time()
model_lang_id = None
target_sr = 16000


@app.on_event("startup")
async def startup_event():
    """Initialize the Allosaurus model on startup"""
    global allosaurus_model, model_ready, model_lang_id
    
    try:
        model_lang_id = os.getenv("ALLOSAURUS_LANG_ID", "eng")
        print(f"Loading Allosaurus model with language ID: {model_lang_id}...")
        
        allosaurus_model = read_recognizer()
        model_ready = True
        print(f"Allosaurus model loaded successfully!")
        
    except Exception as e:
        print(f"Failed to load Allosaurus model: {e}")
        import traceback
        traceback.print_exc()


def process_audio_to_wav(input_audio_path: str) -> str:
    """Convert audio file to WAV format using ffmpeg"""
    try:
        temp_dir = tempfile.gettempdir()
        base_name = os.path.basename(input_audio_path)
        sanitized_base_name = "".join(c if c.isalnum() or c in ('.', '_', '-') else '_' for c in base_name)
        temp_wav_path = os.path.join(temp_dir, f"allosaurus_input_{sanitized_base_name}.wav")
        
        ffmpeg_cmd = [
            'ffmpeg', '-y',
            '-i', input_audio_path,
            '-ac', '1',
            '-ar', str(target_sr),
            '-acodec', 'pcm_s16le',
            temp_wav_path
        ]
        
        result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            raise RuntimeError(f"Error running ffmpeg: {result.stderr}")
            
        return temp_wav_path
        
    except Exception as e:
        raise RuntimeError(f"Error processing audio file: {str(e)}")


def clean_transcription(text: str) -> str:
    """Clean up transcription output by removing setup messages and keeping only phonemes"""
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    if not lines:
        return text
        
    # Look for lines that contain IPA characters
    ipa_pattern = re.compile(r'[a-zæəɪʊɛʌɔɑɒɨʉøœɶɯɤɜɞʏɐːɪʊɛːɔːɪʊeɪɔɪoʊəʊ]')
    for line in reversed(lines):
        if ipa_pattern.search(line):
            return line
            
    # If no IPA pattern found, return the last line
    return lines[-1]


@app.get("/")
async def root():
    return {
        "message": "Allosaurus ASR Service",
        "model": "allosaurus",
        "status": "ready" if model_ready else "initializing"
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    if not model_ready:
        raise HTTPException(status_code=503, detail="Service not ready")
    
    return create_health_response(
        model_name="allosaurus",
        ready=model_ready,
        start_time=start_time
    )


@app.get("/model-info")
async def model_info():
    """Get model information"""
    if not model_ready:
        raise HTTPException(status_code=503, detail="Service not ready")
    
    return {
        "model_name": "allosaurus",
        "language_id": model_lang_id,
        "output_type": "phonemes",
        "sample_rate": target_sr,
        "model_ready": model_ready,
        "service_uptime": time.time() - start_time
    }


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    include_diagnostics: bool = True
):
    """Transcribe uploaded audio file using Allosaurus"""
    if not model_ready:
        raise HTTPException(status_code=503, detail="Allosaurus model not ready")
    
    validate_audio_file(file)
    
    temp_path = await save_temp_file(file)
    processed_audio_path = None
    
    try:
        start_time_transcribe = time.time()
        
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            
            print(f"Processing audio: {temp_path}")
            
            # Convert audio to WAV format
            processed_audio_path = process_audio_to_wav(temp_path)
            
            # Run Allosaurus recognition
            phonemes = allosaurus_model.recognize(processed_audio_path, model_lang_id)
            
            # Clean the transcription
            clean_phonemes = clean_transcription(phonemes)
            
            processing_time = time.time() - start_time_transcribe
            
            model_info_dict = {
                "language_id": model_lang_id,
                "output_type": "phonemes",
                "sample_rate": target_sr
            }
            
            diagnostics = None
            if include_diagnostics:
                diagnostics = {
                    "language_id": model_lang_id,
                    "raw_output": phonemes,
                    "cleaned_output": clean_phonemes,
                    "sample_rate": target_sr,
                    "ffmpeg_conversion": "WAV PCM 16kHz mono"
                }
            
            return create_transcription_response(
                transcription=clean_phonemes,
                processing_time=processing_time,
                model_name="allosaurus",
                model_info=model_info_dict,
                diagnostics=diagnostics
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    
    finally:
        cleanup_temp_file(temp_path)
        if processed_audio_path:
            cleanup_temp_file(processed_audio_path)


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8002))
    uvicorn.run(app, host="0.0.0.0", port=port)