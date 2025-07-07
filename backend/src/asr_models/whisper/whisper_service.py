#!/usr/bin/env python3
"""
Whisper ASR HTTP Service
Self-contained FastAPI service for Whisper transcription
"""
import os
import sys
import time
import warnings
import torch
import uvicorn
from fastapi import HTTPException, UploadFile, File

# Add parent directories to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))

from asr_utils.service_utils import (
    create_fastapi_app, validate_audio_file, save_temp_file, cleanup_temp_file,
    create_health_response, create_transcription_response
)
from asr_utils.audio_utils import get_device

# Import whisper
try:
    import whisper
except ImportError:
    print("Error: Whisper not found. Please install it with 'uv pip install openai-whisper'")
    sys.exit(1)

# Create FastAPI app
app = create_fastapi_app("Whisper ASR Service")

# Global service state
whisper_model = None
model_ready = False
start_time = time.time()
model_name = None
device = None


@app.on_event("startup")
async def startup_event():
    """Initialize the Whisper model on startup"""
    global whisper_model, model_ready, model_name, device
    
    try:
        model_name = os.getenv("WHISPER_MODEL", "base")
        print(f"Loading Whisper model: {model_name}...")
        
        device = get_device()
        print(f"Using device: {device}")
        
        if torch.cuda.is_available():
            print(f"GPU detected: {torch.cuda.get_device_name()}")
        else:
            print("No GPU detected, using CPU")
            
        whisper_model = whisper.load_model(model_name, device=device)
        model_ready = True
        print(f"Whisper model {model_name} loaded successfully!")
        
    except Exception as e:
        print(f"Failed to load Whisper model: {e}")
        import traceback
        traceback.print_exc()


@app.get("/")
async def root():
    return {
        "message": "Whisper ASR Service",
        "model": f"whisper-{model_name}" if model_name else "whisper",
        "status": "ready" if model_ready else "initializing"
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    if not model_ready:
        raise HTTPException(status_code=503, detail="Service not ready")
    
    return create_health_response(
        model_name=f"whisper-{model_name}",
        ready=model_ready,
        start_time=start_time
    )


@app.get("/model-info")
async def model_info():
    """Get model information"""
    if not model_ready:
        raise HTTPException(status_code=503, detail="Service not ready")
    
    return {
        "model_name": f"whisper-{model_name}",
        "whisper_model": model_name,
        "device": str(device),
        "gpu_available": torch.cuda.is_available(),
        "gpu_name": torch.cuda.get_device_name() if torch.cuda.is_available() else None,
        "model_ready": model_ready,
        "service_uptime": time.time() - start_time
    }


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    include_diagnostics: bool = True
):
    """Transcribe uploaded audio file using Whisper"""
    if not model_ready:
        raise HTTPException(status_code=503, detail="Whisper model not ready")
    
    validate_audio_file(file)
    
    temp_path = await save_temp_file(file)
    
    try:
        start_time_transcribe = time.time()
        
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            
            print(f"Transcribing: {temp_path}")
            result = whisper_model.transcribe(temp_path, language="en")
            transcription = result["text"].strip()
            
            processing_time = time.time() - start_time_transcribe
            
            model_info_dict = {
                "whisper_model": model_name,
                "device": str(device),
                "gpu_available": torch.cuda.is_available()
            }
            
            diagnostics = None
            if include_diagnostics:
                diagnostics = {
                    "language": result.get("language", "unknown"),
                    "segments": len(result.get("segments", [])),
                    "device": str(device),
                    "model_name": model_name,
                    "audio_duration": sum(segment.get("end", 0) - segment.get("start", 0) 
                                       for segment in result.get("segments", [])),
                    "confidence_scores": [segment.get("avg_logprob", 0) 
                                        for segment in result.get("segments", [])]
                }
            
            return create_transcription_response(
                transcription=transcription,
                processing_time=processing_time,
                model_name=f"whisper-{model_name}",
                model_info=model_info_dict,
                diagnostics=diagnostics
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    
    finally:
        cleanup_temp_file(temp_path)


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)