#!/usr/bin/env python3
"""
Wav2Vec ASR HTTP Service
Self-contained FastAPI service for Wav2Vec2 transcription
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
from asr_utils.audio_utils import load_audio, get_device

# Import Wav2Vec components
try:
    from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
except ImportError:
    print("Error: Transformers not found. Please install it with 'uv pip install transformers'")
    sys.exit(1)

# Create FastAPI app
app = create_fastapi_app("Wav2Vec ASR Service")

# Global service state
wav2vec_model = None
processor = None
model_ready = False
start_time = time.time()
model_name = None
device = None


@app.on_event("startup")
async def startup_event():
    """Initialize the Wav2Vec model on startup"""
    global wav2vec_model, processor, model_ready, model_name, device
    
    try:
        model_name = os.getenv("WAV2VEC_MODEL", "facebook/wav2vec2-base-960h")
        print(f"Loading Wav2Vec 2.0 model: {model_name}...")
        
        processor = Wav2Vec2Processor.from_pretrained(model_name)
        wav2vec_model = Wav2Vec2ForCTC.from_pretrained(model_name)
        
        device = get_device()
        wav2vec_model = wav2vec_model.to(device)
        print(f"Using device: {device}")
        
        model_ready = True
        print(f"Wav2Vec model loaded successfully!")
        
    except Exception as e:
        print(f"Failed to load Wav2Vec model: {e}")
        import traceback
        traceback.print_exc()


@app.get("/")
async def root():
    return {
        "message": "Wav2Vec ASR Service",
        "model": f"wav2vec-{model_name.split('/')[-1]}" if model_name else "wav2vec",
        "status": "ready" if model_ready else "initializing"
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    if not model_ready:
        raise HTTPException(status_code=503, detail="Service not ready")
    
    return create_health_response(
        model_name=f"wav2vec-{model_name.split('/')[-1]}" if model_name else "wav2vec",
        ready=model_ready,
        start_time=start_time
    )


@app.get("/model-info")
async def model_info():
    """Get model information"""
    if not model_ready:
        raise HTTPException(status_code=503, detail="Service not ready")
    
    return {
        "model_name": f"wav2vec-{model_name.split('/')[-1]}" if model_name else "wav2vec",
        "full_model_name": model_name,
        "device": str(device),
        "gpu_available": torch.cuda.is_available(),
        "gpu_name": torch.cuda.get_device_name() if torch.cuda.is_available() else None,
        "sample_rate": 16000,
        "model_ready": model_ready,
        "service_uptime": time.time() - start_time
    }


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    include_diagnostics: bool = True
):
    """Transcribe uploaded audio file using Wav2Vec"""
    if not model_ready:
        raise HTTPException(status_code=503, detail="Wav2Vec model not ready")
    
    validate_audio_file(file)
    
    temp_path = await save_temp_file(file)
    
    try:
        start_time_transcribe = time.time()
        
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            
            print(f"Loading and processing audio: {temp_path}")
            audio_data = load_audio(temp_path)
            
            inputs = processor(audio_data, sampling_rate=16000, return_tensors="pt")
            input_values = inputs.input_values.to(device)
            
            with torch.no_grad():
                logits = wav2vec_model(input_values).logits
            
            predicted_ids = torch.argmax(logits, dim=-1)
            transcription = processor.batch_decode(predicted_ids)[0]
            
            processing_time = time.time() - start_time_transcribe
            
            model_info_dict = {
                "full_model_name": model_name,
                "device": str(device),
                "gpu_available": torch.cuda.is_available(),
                "sample_rate": 16000
            }
            
            diagnostics = None
            if include_diagnostics:
                diagnostics = {
                    "device": str(device),
                    "model_name": model_name,
                    "input_shape": list(input_values.shape),
                    "logits_shape": list(logits.shape),
                    "sample_rate": 16000,
                    "gpu_used": torch.cuda.is_available() and str(device) != "cpu"
                }
            
            return create_transcription_response(
                transcription=transcription,
                processing_time=processing_time,
                model_name=f"wav2vec-{model_name.split('/')[-1]}" if model_name else "wav2vec",
                model_info=model_info_dict,
                diagnostics=diagnostics
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    
    finally:
        cleanup_temp_file(temp_path)


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8002))
    uvicorn.run(app, host="0.0.0.0", port=port)