#!/usr/bin/env python3
"""
VOSK ASR HTTP Service
Self-contained FastAPI service for VOSK transcription
"""
import os
import sys
import time
import json
import wave
import numpy as np
import uvicorn
from fastapi import HTTPException, UploadFile, File

# Add parent directories to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))

from asr_utils.service_utils import (
    create_fastapi_app, validate_audio_file, save_temp_file, cleanup_temp_file,
    create_health_response, create_transcription_response
)
from asr_utils.audio_utils import load_audio

# Import VOSK
try:
    from vosk import Model, KaldiRecognizer
except ImportError:
    print("Error: VOSK not found. Please install it with 'uv pip install vosk'")
    sys.exit(1)

# Create FastAPI app
app = create_fastapi_app("VOSK ASR Service")

# Global service state
vosk_model = None
model_ready = False
start_time = time.time()
model_lang = "en-us"


@app.on_event("startup")
async def startup_event():
    """Initialize the VOSK model on startup using automatic download"""
    global vosk_model, model_ready, model_lang
    
    try:
        model_lang = os.getenv("VOSK_MODEL_LANG", "en-us")
        print(f"Loading VOSK model for language: {model_lang}...")
        
        # Use Vosk's automatic model download by language
        vosk_model = Model(lang=model_lang)
        model_ready = True
        print(f"VOSK model loaded successfully!")
        
    except Exception as e:
        print(f"Failed to load VOSK model: {e}")
        import traceback
        traceback.print_exc()


@app.get("/")
async def root():
    return {
        "message": "VOSK ASR Service",
        "model": "vosk",
        "status": "ready" if model_ready else "initializing"
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    if not model_ready:
        raise HTTPException(status_code=503, detail="Service not ready")
    
    return create_health_response(
        model_name="vosk",
        ready=model_ready,
        start_time=start_time
    )


@app.get("/model-info")
async def model_info():
    """Get model information"""
    if not model_ready:
        raise HTTPException(status_code=503, detail="Service not ready")
    
    return {
        "model_name": "vosk",
        "model_lang": model_lang,
        "model_type": "vosk",
        "sample_rate": 16000,
        "audio_format": "WAV PCM 16kHz mono",
        "model_ready": model_ready,
        "service_uptime": time.time() - start_time
    }


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    include_diagnostics: bool = True
):
    """Transcribe uploaded audio file using VOSK"""
    if not model_ready:
        raise HTTPException(status_code=503, detail="VOSK model not ready")
    
    # Accept any audio format like other services
    validate_audio_file(file)
    
    temp_path = await save_temp_file(file)
    processed_audio_path = None
    
    try:
        start_time_transcribe = time.time()
        
        print(f"Loading and processing audio: {temp_path}")
        
        # Load audio using audio_utils (handles any format)
        audio_data = load_audio(temp_path)
        
        # Convert to WAV format for VOSK processing
        processed_audio_path = temp_path + "_vosk.wav"
        audio_data_int16 = (audio_data * 32768.0).astype(np.int16)
        
        with wave.open(processed_audio_path, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2) 
            wf.setframerate(16000)
            wf.writeframes(audio_data_int16.tobytes())
        
        print(f"Converted audio to WAV format: {processed_audio_path}")
        
        # Open the converted audio file
        wf = wave.open(processed_audio_path, "rb")
        
        # Create recognizer
        rec = KaldiRecognizer(vosk_model, wf.getframerate())
        
        # Process audio
        results = []
        while True:
            data = wf.readframes(4000)
            if len(data) == 0:
                break
            if rec.AcceptWaveform(data):
                result = json.loads(rec.Result())
                if result.get('text'):
                    results.append(result['text'])
        
        # Get final result
        final_result = json.loads(rec.FinalResult())
        if final_result.get('text'):
            results.append(final_result['text'])
        
        # Combine all results
        transcription = ' '.join(results).strip()
        
        processing_time = time.time() - start_time_transcribe
        
        model_info_dict = {
            "model_lang": model_lang,
            "sample_rate": wf.getframerate(),
            "audio_format": "WAV PCM 16kHz mono (converted)"
        }
        
        diagnostics = None
        if include_diagnostics:
            diagnostics = {
                "model_lang": model_lang,
                "audio_duration": wf.getnframes() / wf.getframerate(),
                "sample_rate": wf.getframerate(),
                "channels": wf.getnchannels(),
                "sample_width": wf.getsampwidth(),
                "original_format": file.filename.split('.')[-1] if file.filename else "unknown",
                "converted_to_wav": True
            }
        
        wf.close()
        
        return create_transcription_response(
            transcription=transcription,
            processing_time=processing_time,
            model_name="vosk",
            model_info=model_info_dict,
            diagnostics=diagnostics
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    
    finally:
        cleanup_temp_file(temp_path)
        if processed_audio_path and os.path.exists(processed_audio_path):
            cleanup_temp_file(processed_audio_path)


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8005))
    uvicorn.run(app, host="0.0.0.0", port=port)