#!/usr/bin/env python3
"""
Shared utilities for ASR model HTTP services
Common FastAPI patterns and response models
"""
import os
import tempfile
import time
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    model: str
    ready: bool
    uptime_seconds: float


class TranscriptionResponse(BaseModel):
    transcription: str
    processing_time: float
    model: str
    model_info: dict
    diagnostics: Optional[dict] = None


def create_fastapi_app(title: str) -> FastAPI:
    """Create a FastAPI app with standard configuration"""
    app = FastAPI(title=title, version="1.0.0")
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    return app


def validate_audio_file(file: UploadFile, allowed_formats: list = None) -> None:
    """Validate uploaded audio file format"""
    if allowed_formats is None:
        allowed_formats = ['.mp3', '.wav', '.flac', '.m4a']
    
    if not file.filename.lower().endswith(tuple(allowed_formats)):
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported audio format. Allowed: {', '.join(allowed_formats)}"
        )


async def save_temp_file(file: UploadFile) -> str:
    """Save uploaded file to temporary location and return path"""
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as temp_file:
        content = await file.read()
        temp_file.write(content)
        temp_file.flush()
        return temp_file.name


def cleanup_temp_file(file_path: str) -> None:
    """Clean up temporary file"""
    try:
        os.unlink(file_path)
    except OSError:
        pass  # File might already be deleted


def create_health_response(model_name: str, ready: bool, start_time: float) -> HealthResponse:
    """Create standardized health response"""
    return HealthResponse(
        status="healthy" if ready else "initializing",
        model=model_name,
        ready=ready,
        uptime_seconds=time.time() - start_time
    )


def create_transcription_response(
    transcription: str,
    processing_time: float,
    model_name: str,
    model_info: dict,
    diagnostics: Optional[dict] = None
) -> TranscriptionResponse:
    """Create standardized transcription response"""
    return TranscriptionResponse(
        transcription=transcription,
        processing_time=processing_time,
        model=model_name,
        model_info=model_info,
        diagnostics=diagnostics
    )