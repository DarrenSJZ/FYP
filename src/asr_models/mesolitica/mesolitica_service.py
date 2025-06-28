#!/usr/bin/env python3
"""
Mesolitica ASR HTTP Service
Self-contained FastAPI service for Mesolitica Wav2Vec2 transcription
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

# Import Mesolitica components
try:
    from transformers.models.wav2vec2 import Wav2Vec2Processor, Wav2Vec2ForCTC
except ImportError:
    print("Error: Transformers not found. Please install it with 'uv pip install transformers'")
    sys.exit(1)

# Create FastAPI app
app = create_fastapi_app("Mesolitica ASR Service")

# Global service state
mesolitica_model = None
processor = None
model_ready = False
start_time = time.time()
model_name = None
device = None


@app.on_event("startup")
async def startup_event():
    """Initialize the Mesolitica model on startup"""
    global mesolitica_model, processor, model_ready, model_name, device
    
    try:
        model_name = os.getenv("MESOLITICA_MODEL", "mesolitica/wav2vec2-xls-r-300m-mixed")
        print(f"Loading Mesolitica Wav2Vec2 model: {model_name}...")
        
        processor = Wav2Vec2Processor.from_pretrained(model_name)
        mesolitica_model = Wav2Vec2ForCTC.from_pretrained(model_name).eval()
        
        device = get_device()
        if torch.cuda.is_available():
            mesolitica_model = mesolitica_model.to(device)
        print(f"Using device: {device}")
        
        model_ready = True
        print(f"Mesolitica model loaded successfully!")
        
    except Exception as e:
        print(f"Failed to load Mesolitica model: {e}")
        import traceback
        traceback.print_exc()


@app.get("/")
async def root():
    return {
        "message": "Mesolitica ASR Service",
        "model": f"mesolitica-{model_name.split('/')[-1]}" if model_name else "mesolitica",
        "status": "ready" if model_ready else "initializing"
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    if not model_ready:
        raise HTTPException(status_code=503, detail="Service not ready")
    
    return create_health_response(
        model_name=f"mesolitica-{model_name.split('/')[-1]}" if model_name else "mesolitica",
        ready=model_ready,
        start_time=start_time
    )


@app.get("/model-info")
async def model_info():
    """Get model information"""
    if not model_ready:
        raise HTTPException(status_code=503, detail="Service not ready")
    
    return {
        "model_name": f"mesolitica-{model_name.split('/')[-1]}" if model_name else "mesolitica",
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
    """Transcribe uploaded audio file using Mesolitica"""
    if not model_ready:
        raise HTTPException(status_code=503, detail="Mesolitica model not ready")
    
    validate_audio_file(file)
    
    temp_path = await save_temp_file(file)
    
    try:
        start_time_transcribe = time.time()
        
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            
            print(f"Loading and processing audio: {temp_path}")
            audio = load_audio(temp_path)
            
            inputs = processor(audio, sampling_rate=16000, return_tensors="pt", padding=True)
            
            if torch.cuda.is_available():
                inputs = {k: v.to(device) for k, v in inputs.items()}
            
            with torch.no_grad():
                logits = mesolitica_model(**inputs).logits
            
            pred_ids = torch.argmax(logits, dim=-1)
            transcription = processor.batch_decode(pred_ids, skip_special_tokens=True)[0]
            
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
                    "input_shape": inputs["input_values"].shape if "input_values" in inputs else "unknown",
                    "logits_shape": list(logits.shape),
                    "sample_rate": 16000,
                    "gpu_used": torch.cuda.is_available() and str(device) != "cpu"
                }
            
            return create_transcription_response(
                transcription=transcription,
                processing_time=processing_time,
                model_name=f"mesolitica-{model_name.split('/')[-1]}" if model_name else "mesolitica",
                model_info=model_info_dict,
                diagnostics=diagnostics
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    
    finally:
        cleanup_temp_file(temp_path)


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8003))
    uvicorn.run(app, host="0.0.0.0", port=port)