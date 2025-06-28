#!/usr/bin/env python3
"""
Moonshine ASR HTTP Service
Self-contained FastAPI service for Moonshine transcription
"""
import os
import sys
import time
import warnings
import uvicorn
from fastapi import HTTPException, UploadFile, File

# Add parent directories to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))

from asr_utils.service_utils import (
    create_fastapi_app, validate_audio_file, save_temp_file, cleanup_temp_file,
    create_health_response, create_transcription_response
)
from asr_utils.audio_utils import load_audio, get_device

# moonshine should be available via the shared venv in PATH
# sys.path.append(os.path.join(os.path.dirname(__file__), 'env_moonshine/lib/python3.12/site-packages'))

# Import Moonshine
try:
    import moonshine
except ImportError:
    print("Error: Moonshine not found. Please install it or check the environment path")
    sys.exit(1)

# Create FastAPI app
app = create_fastapi_app("Moonshine ASR Service")

# Global service state
moonshine_model = None
tokenizer = None
model_ready = False
start_time = time.time()
model_name = None
device = None


@app.on_event("startup")
async def startup_event():
    """Initialize the Moonshine model on startup"""
    global moonshine_model, tokenizer, model_ready, model_name, device
    
    try:
        model_name = os.getenv("MOONSHINE_MODEL", "moonshine/base")
        print(f"Loading Moonshine model: {model_name}...")
        
        moonshine_model = moonshine.load_model(model_name)
        tokenizer = moonshine.load_tokenizer()
        device = get_device()
        print(f"Using device: {device}")
        
        model_ready = True
        print(f"Moonshine model loaded successfully!")
        
    except Exception as e:
        print(f"Failed to load Moonshine model: {e}")
        import traceback
        traceback.print_exc()


@app.get("/")
async def root():
    return {
        "message": "Moonshine ASR Service",
        "model": f"moonshine-{model_name.split('/')[-1]}" if model_name else "moonshine",
        "status": "ready" if model_ready else "initializing"
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    if not model_ready:
        raise HTTPException(status_code=503, detail="Service not ready")
    
    return create_health_response(
        model_name=f"moonshine-{model_name.split('/')[-1]}" if model_name else "moonshine",
        ready=model_ready,
        start_time=start_time
    )


@app.get("/model-info")
async def model_info():
    """Get model information"""
    if not model_ready:
        raise HTTPException(status_code=503, detail="Service not ready")
    
    return {
        "model_name": f"moonshine-{model_name.split('/')[-1]}" if model_name else "moonshine",
        "full_model_name": model_name,
        "device": str(device),
        "sample_rate": 16000,
        "model_ready": model_ready,
        "service_uptime": time.time() - start_time
    }


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    include_diagnostics: bool = True
):
    """Transcribe uploaded audio file using Moonshine"""
    if not model_ready:
        raise HTTPException(status_code=503, detail="Moonshine model not ready")
    
    validate_audio_file(file)
    
    temp_path = await save_temp_file(file)
    
    try:
        start_time_transcribe = time.time()
        
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            
            print(f"Loading and processing audio: {temp_path}")
            audio_data = load_audio(temp_path)
            print(f"Audio loaded successfully. Shape: {audio_data.shape}, dtype: {audio_data.dtype}")
            print(f"Audio range: min={audio_data.min():.6f}, max={audio_data.max():.6f}")
            
            # Prepare input for moonshine
            audio_input = audio_data[None, ...]
            print(f"Audio input shape: {audio_input.shape}")
            
            # Generate tokens using Moonshine
            print("Calling moonshine_model.generate()...")
            tokens = moonshine_model.generate(audio_input)
            print(f"Tokens generated successfully. Shape: {tokens.shape if hasattr(tokens, 'shape') else 'No shape attr'}")
            
            # Decode tokens to text (load tokenizer fresh like stt_model does)
            print("Loading tokenizer and decoding...")
            transcription = moonshine.load_tokenizer().decode_batch(tokens)[0]
            print(f"Transcription successful: {transcription[:50]}...")
            
            processing_time = time.time() - start_time_transcribe
            
            model_info_dict = {
                "full_model_name": model_name,
                "device": str(device),
                "sample_rate": 16000
            }
            
            diagnostics = None
            if include_diagnostics:
                diagnostics = {
                    "device": str(device),
                    "model_name": model_name,
                    "audio_shape": list(audio_data.shape),
                    "tokens_generated": len(tokens[0]) if tokens is not None and tokens.shape[0] > 0 else 0,
                    "sample_rate": 16000
                }
            
            return create_transcription_response(
                transcription=transcription,
                processing_time=processing_time,
                model_name=f"moonshine-{model_name.split('/')[-1]}" if model_name else "moonshine",
                model_info=model_info_dict,
                diagnostics=diagnostics
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    
    finally:
        cleanup_temp_file(temp_path)


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8004))
    uvicorn.run(app, host="0.0.0.0", port=port)