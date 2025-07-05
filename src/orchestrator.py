#!/usr/bin/env python3
"""
ASR Docker Orchestrator - Manages parallel execution of ASR models in Docker containers
Similar to the benchmarks/asr_model_comparison.py but for containerized services
"""
import asyncio
import aiohttp
import json
import time
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path
import base64
import tempfile
import os

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

class TranscriptionRequest(BaseModel):
    audio_data: str  # Base64 encoded audio file
    filename: str
    models: Optional[List[str]] = None  # Specific models to use, default: all
    include_diagnostics: bool = True

class TranscriptionResponse(BaseModel):
    audio_filename: str
    timestamp: str
    parallel_execution: bool
    models_requested: List[str]
    successful_models: int
    total_processing_time: float
    results: Dict

class ASROrchestrator:
    def __init__(self):
        # Gemini API configuration
        self.gemini_api_key = os.getenv("GEMINI_API_KEY")
        self.gemini_base_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent"
        
        # Tavily API configuration for web search
        self.tavily_api_key = os.getenv("TAVILY_API_KEY")
        self.tavily_base_url = "https://api.tavily.com/search"
        
        # Define ASR model services - these will be Docker containers
        self.model_services = {
            "whisper": {
                "url": "http://whisper-service:8001",
                "endpoint": "/transcribe",
                "timeout": 120
            },
            "wav2vec": {
                "url": "http://wav2vec-service:8002", 
                "endpoint": "/transcribe",
                "timeout": 120
            },
            "moonshine": {
                "url": "http://moonshine-service:8003",
                "endpoint": "/transcribe", 
                "timeout": 120
            },
            "mesolitica": {
                "url": "http://mesolitica-service:8004",
                "endpoint": "/transcribe",
                "timeout": 120
            },
            "vosk": {
                "url": "http://vosk-service:8005",
                "endpoint": "/transcribe",
                "timeout": 120
            },
            "allosaurus": {
                "url": "http://allosaurus-service:8006",
                "endpoint": "/transcribe",
                "timeout": 120
            }
        }
        
    async def health_check_service(self, model_name: str, session: aiohttp.ClientSession) -> bool:
        """Check if a model service is healthy and ready"""
        try:
            service = self.model_services[model_name]
            async with session.get(
                f"{service['url']}/health", 
                timeout=aiohttp.ClientTimeout(total=5)
            ) as response:
                return response.status == 200
        except Exception:
            return False
    
    async def transcribe_with_service(
        self, 
        model_name: str, 
        audio_data: bytes, 
        filename: str,
        session: aiohttp.ClientSession,
        include_diagnostics: bool = True
    ) -> Dict:
        """Send transcription request to a specific ASR service"""
        service = self.model_services[model_name]
        start_time = time.time()
        
        try:
            # Prepare multipart form data
            data = aiohttp.FormData()
            data.add_field('file', audio_data, filename=filename, content_type='audio/mpeg')
            data.add_field('include_diagnostics', str(include_diagnostics).lower())
            
            # Send request to model service
            async with session.post(
                f"{service['url']}{service['endpoint']}",
                data=data,
                timeout=aiohttp.ClientTimeout(total=service['timeout'])
            ) as response:
                end_time = time.time()
                
                if response.status == 200:
                    result = await response.json()
                    
                    # Standardize response format
                    return {
                        "model": model_name,
                        "status": "success",
                        "transcription": result.get("transcription", ""),
                        "processing_time": end_time - start_time,
                        "service_processing_time": result.get("processing_time", 0),
                        "model_info": result.get("model_info", {}),
                        "diagnostics": result.get("diagnostics", {}) if include_diagnostics else {}
                    }
                else:
                    error_text = await response.text()
                    return {
                        "model": model_name,
                        "status": "error",
                        "error": f"HTTP {response.status}: {error_text}",
                        "processing_time": end_time - start_time
                    }
                    
        except asyncio.TimeoutError:
            return {
                "model": model_name,
                "status": "error", 
                "error": f"Request timeout after {service['timeout']} seconds",
                "processing_time": time.time() - start_time
            }
        except Exception as e:
            return {
                "model": model_name,
                "status": "error",
                "error": str(e),
                "processing_time": time.time() - start_time
            }
    
    async def transcribe_parallel(
        self, 
        audio_data: bytes, 
        filename: str,
        models: Optional[List[str]] = None,
        include_diagnostics: bool = True
    ) -> Dict:
        """
        Run transcription across multiple ASR models in parallel
        Similar to the ProcessPoolExecutor approach in benchmarks/asr_model_comparison.py
        """
        start_time = time.time()
        
        # Use all models if none specified
        if models is None:
            models = list(self.model_services.keys())
        
        # Validate requested models
        invalid_models = [m for m in models if m not in self.model_services]
        if invalid_models:
            raise ValueError(f"Invalid models: {invalid_models}")
        
        results = {}
        
        # Create aiohttp session for all requests
        async with aiohttp.ClientSession() as session:
            # First, check which services are healthy
            health_checks = await asyncio.gather(*[
                self.health_check_service(model, session) for model in models
            ], return_exceptions=True)
            
            healthy_models = [
                models[i] for i, is_healthy in enumerate(health_checks) 
                if isinstance(is_healthy, bool) and is_healthy
            ]
            
            if not healthy_models:
                return {
                    "audio_filename": filename,
                    "timestamp": datetime.now().isoformat(),
                    "parallel_execution": True,
                    "models_requested": models,
                    "healthy_models": [],
                    "successful_models": 0,
                    "total_processing_time": time.time() - start_time,
                    "error": "No healthy ASR services available",
                    "results": {}
                }
            
            # Run transcription tasks in parallel (like ProcessPoolExecutor)
            tasks = [
                self.transcribe_with_service(
                    model, audio_data, filename, session, include_diagnostics
                ) 
                for model in healthy_models
            ]
            
            # Wait for all tasks to complete
            transcription_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process results
            for i, result in enumerate(transcription_results):
                model_name = healthy_models[i]
                if isinstance(result, Exception):
                    results[model_name] = {
                        "model": model_name,
                        "status": "error",
                        "error": str(result),
                        "processing_time": 0
                    }
                else:
                    results[model_name] = result
        
        end_time = time.time()
        successful_models = len([r for r in results.values() if r["status"] == "success"])
        
        return {
            "audio_filename": filename,
            "timestamp": datetime.now().isoformat(),
            "parallel_execution": True,
            "models_requested": models,
            "healthy_models": healthy_models,
            "successful_models": successful_models,
            "total_processing_time": end_time - start_time,
            "results": results
        }
    
    async def call_gemini_api(self, prompt: str, session: aiohttp.ClientSession) -> Dict:
        """Call Google Gemini 2.0 Flash API"""
        if not self.gemini_api_key:
            return {"error": "GEMINI_API_KEY not configured"}
        
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.3,
                "topK": 40,
                "topP": 0.95,
                "maxOutputTokens": 4096,
            }
        }
        
        try:
            async with session.post(
                f"{self.gemini_base_url}?key={self.gemini_api_key}",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    return {
                        "status": "success",
                        "response": result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                    }
                else:
                    error_text = await response.text()
                    return {"status": "error", "error": f"HTTP {response.status}: {error_text}"}
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    async def search_tavily(self, query: str, session: aiohttp.ClientSession) -> Dict:
        """Search web using Tavily API for context"""
        if not self.tavily_api_key:
            return {"status": "skip", "message": "TAVILY_API_KEY not configured"}
        
        payload = {
            "api_key": self.tavily_api_key,
            "query": query,
            "search_depth": "basic",
            "include_answer": True,
            "include_raw_content": False,
            "max_results": 3
        }
        
        try:
            async with session.post(
                self.tavily_base_url,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    return {
                        "status": "success",
                        "answer": result.get("answer", ""),
                        "results": result.get("results", [])[:2]  # Top 2 results
                    }
                else:
                    return {"status": "error", "error": f"HTTP {response.status}"}
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    
    def extract_search_terms(self, transcriptions: List[str]) -> List[str]:
        """Extract potential search terms from transcriptions"""
        import re
        
        # Combine all transcriptions
        text = " ".join(transcriptions).lower()
        
        # Extract potential proper nouns, technical terms, or unclear words
        search_terms = []
        
        # Look for capitalized words (might be proper nouns)
        proper_nouns = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', " ".join(transcriptions))
        search_terms.extend(proper_nouns[:3])  # Max 3 proper nouns
        
        # Look for technical/scientific terms (words with specific patterns)
        technical_terms = re.findall(r'\b(?:\w*(?:tion|ism|ology|graphy|metry)\w*|\w+(?:gene|protein|enzyme)\w*)\b', text)
        search_terms.extend(technical_terms[:2])  # Max 2 technical terms
        
        # Look for numbers + units or measurements
        measurements = re.findall(r'\b\d+\s*(?:degrees?|celsius|fahrenheit|meters?|feet|pounds?|kilograms?|hours?|minutes?|seconds?)\b', text)
        search_terms.extend(measurements[:2])
        
        return list(set(search_terms))  # Remove duplicates

# Create FastAPI app
app = FastAPI(title="ASR Docker Orchestrator", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True, 
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize orchestrator
orchestrator = ASROrchestrator()

@app.get("/")
async def root():
    return {"message": "ASR Docker Orchestrator", "version": "1.0.0"}

@app.get("/health")
async def health():
    """Health check endpoint"""
    async with aiohttp.ClientSession() as session:
        health_results = {}
        for model_name in orchestrator.model_services.keys():
            health_results[model_name] = await orchestrator.health_check_service(model_name, session)
    
    healthy_count = sum(health_results.values())
    total_count = len(health_results)
    
    return {
        "status": "healthy" if healthy_count > 0 else "unhealthy",
        "healthy_services": healthy_count,
        "total_services": total_count,
        "services": health_results
    }

@app.get("/models")
async def list_models():
    """List available ASR models"""
    return {
        "available_models": list(orchestrator.model_services.keys()),
        "model_details": orchestrator.model_services
    }

@app.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    models: Optional[str] = None,  # Comma-separated model names
    include_diagnostics: bool = True
):
    """
    Transcribe audio using multiple ASR models in parallel
    
    Similar to benchmarks/asr_model_comparison.py but orchestrating Docker containers
    """
    try:
        # Read audio file
        audio_data = await file.read()
        
        # Parse models parameter
        requested_models = None
        if models:
            requested_models = [m.strip() for m in models.split(",")]
        
        # Run parallel transcription
        results = await orchestrator.transcribe_parallel(
            audio_data, 
            file.filename,
            requested_models,
            include_diagnostics
        )
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transcribe-json")
async def transcribe_audio_json(request: TranscriptionRequest):
    """
    Transcribe audio from JSON payload (base64 encoded audio)
    """
    try:
        # Decode base64 audio data
        audio_data = base64.b64decode(request.audio_data)
        
        # Run parallel transcription  
        results = await orchestrator.transcribe_parallel(
            audio_data,
            request.filename, 
            request.models,
            request.include_diagnostics
        )
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transcribe-for-gemini")
async def transcribe_for_gemini(
    file: UploadFile = File(...),
    context: str = "Speech recognition analysis",
    models: Optional[str] = None
):
    """
    Transcribe audio and format output for Gemini LLM API
    """
    try:
        # Get transcription results
        audio_data = await file.read()
        requested_models = [m.strip() for m in models.split(",")] if models else None
        
        asr_results = await orchestrator.transcribe_parallel(
            audio_data, file.filename, requested_models, True
        )
        
        # Create Gemini-formatted payload
        gemini_payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": f"""Please analyze the following ASR transcription results:

Context: {context}

ASR Results:
{json.dumps(asr_results, indent=2)}

Please provide:
1. Transcription quality assessment
2. Confidence level estimation  
3. Consensus transcription from multiple models
4. Any potential errors or improvements
5. Summary of the audio content
"""
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.3,
                "topK": 40,
                "topP": 0.95,
                "maxOutputTokens": 4096,
            }
        }
        
        return {
            "asr_results": asr_results,
            "gemini_payload": gemini_payload
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transcribe-with-gemini")
async def transcribe_with_gemini(
    file: UploadFile = File(...),
    context: str = "Speech recognition analysis",
    models: Optional[str] = None
):
    """
    Transcribe audio and get Gemini analysis
    """
    try:
        # Get transcription results
        audio_data = await file.read()
        requested_models = [m.strip() for m in models.split(",")] if models else None
        
        asr_results = await orchestrator.transcribe_parallel(
            audio_data, file.filename, requested_models, True
        )
        
        # Extract transcriptions for analysis
        transcriptions = [
            result.get("transcription", "") for result in asr_results["results"].values()
            if result.get("status") == "success" and result.get("transcription")
        ]
        
        # Extract Allosaurus result specifically for speech anomaly detection
        allosaurus_result = asr_results["results"].get("allosaurus", {})
        allosaurus_transcription = allosaurus_result.get("transcription", "") if allosaurus_result.get("status") == "success" else ""
        allosaurus_timing = allosaurus_result.get("timed_phonemes", []) if allosaurus_result.get("status") == "success" else []
        
        
        # Get web search context
        web_context = ""
        async with aiohttp.ClientSession() as session:
            # Extract search terms from transcriptions
            search_terms = orchestrator.extract_search_terms(transcriptions)
            
            if search_terms:
                # Search for the most relevant terms
                search_query = " ".join(search_terms[:2])  # Use top 2 search terms
                search_result = await orchestrator.search_tavily(search_query, session)
                
                if search_result.get("status") == "success":
                    web_context = f"""
Web Search Context (query: "{search_query}"):
Answer: {search_result.get('answer', 'No answer available')}

Top Results:
{json.dumps(search_result.get('results', []), indent=2)}
"""
        
        # Create enhanced prompt for Gemini
        prompt = f"""Please analyze the following ASR transcription results with enhanced logic and context:

Context: {context}

ASR Results:
{json.dumps(asr_results, indent=2)}

{web_context}

Analysis Instructions:
1. TRANSCRIPTION CONSENSUS: Compare all transcriptions and identify the most likely correct version by:
   - Looking for common words/phrases across models
   - Considering phonetic similarities between different transcriptions
   - Using the web search context to validate technical terms or proper nouns
   
2. QUALITY ASSESSMENT: Evaluate based on:
   - Model agreement (unanimous, majority, split, conflicted)
   - Consistency of technical terms with web search results
   - Logical coherence of the transcription
   
3. CONFIDENCE SCORING: Provide 0-1 confidence score considering:
   - Number of models in agreement
   - Validation from web search context
   - Presence of technical terms that match search results
   
4. ERROR DETECTION: Identify potential issues like:
   - Homophones (words that sound alike but have different meanings)
   - Technical terms that might be misheard
   - Proper nouns that need verification
   
5. CONTEXT INTEGRATION: Use web search results to:
   - Correct technical terminology
   - Validate proper nouns and specialized terms
   - Provide additional context for understanding

6. ACCENT DETECTION: Analyze transcription patterns to identify potential accent indicators:
   - Look for consistent vowel substitutions across models (e.g., "dance"→"dahnce", "can't"→"cahnt" = British)
   - Identify consonant patterns like th→d, v→w, r-dropping, or h-dropping
   - Note regional pronunciation variations in proper nouns or place names
   - Consider which ASR models performed better/worse (may indicate accent familiarity)
   - Look for systematic phonetic shifts that suggest specific accent origins
   - Analyze rhythm and stress patterns if detectable in transcription differences

7. SYSTEMATIC WORD-TO-PHONEME MAPPING FOR PARTICLE DETECTION:
   
   Allosaurus Transcription: "{allosaurus_transcription}"
   Allosaurus Timing Data: {json.dumps(allosaurus_timing, indent=2)}
   
   CRITICAL ALGORITHM - Follow this exact sequence:
   
   STEP 1: ESTABLISH CONSENSUS TRANSCRIPTION
   - Use the consensus transcription from Steps 1-2 above (DO NOT change this in final output)
   - This is your BASE TRANSCRIPTION that must remain unchanged
   
   STEP 2: WORD-TO-PHONEME MAPPING
   For each word in the consensus transcription, map to expected IPA phonemes:
   - "Don't" → [d, oʊ, n, t]
   - "be" → [b, i]  
   - "like" → [l, aɪ, k]
   - "that" → [ð, æ, t]
   - "what" → [w, ʌ, t] or [w, ɑ, t]
   - "the" → [ð, ə]
   - "fuck" → [f, ʌ, k]
   - "man" → [m, æ, n]
   
   STEP 3: OUTLIER PHONEME IDENTIFICATION
   Create a systematic mapping to find OUTLIER phonemes:
   
   A. List ALL Allosaurus phonemes: {allosaurus_transcription}
   B. List ALL expected phonemes from consensus words (from Step 2)
   C. SUBTRACT expected phonemes from Allosaurus phonemes
   D. REMAINING phonemes = POTENTIAL PARTICLES
   
   EXAMPLE PROCESS:
   - Allosaurus: [n, ʊ, n, b, i, l, a, ɪ, n, d, ə, l, a, ʊ, w, ɛ, t, ə, f, ɔ, s, t, v, æ, m]
   - Expected from "Don't be like that what the fuck man": [d, oʊ, n, t, b, i, l, aɪ, k, ð, æ, t, w, ʌ, t, ð, ə, f, ʌ, k, m, æ, n]
   - OUTLIERS = phonemes in Allosaurus that don't appear in expected sequence
   - Check if outliers match particle registry patterns
   
   CRITICAL: Focus on phoneme sequences that appear in Allosaurus but have NO correspondence to expected word phonemes
   
   PARTICLE REGISTRY:
   - "la" → [l, a] (Malaysian/Singaporean)
   - "lor" → [l, ɔ, r] (Malaysian/Singaporean) 
   - "meh" → [m, ɛ] (Cantonese English)
   - "ah" → [ɑ] (Malaysian/Singaporean)
   - "ja" → [j, a] (German)
   - "na" → [n, a] (Indian English)
   
   STEP 4: INTELLIGENT PARTICLE VALIDATION AND PLACEMENT
   
   For each potential particle identified in outlier analysis:
   
   A. TIMING ANALYSIS: Determine rough timing position from Allosaurus data
   B. LINGUISTIC VALIDATION: Check if placement makes contextual sense
   C. CULTURAL PATTERN MATCHING: Verify particle usage follows natural patterns
   
   MATHEMATICAL PLACEMENT VALIDATION:
   
   For each detected particle, calculate placement score using these metrics:
   
   A. TIMING GAP SCORE:
   - Gap before particle: >0.05s = +2 points, >0.02s = +1 point, <0.02s = 0 points
   - Gap after particle: >0.05s = +2 points, >0.02s = +1 point, <0.02s = 0 points
   
   B. PHONEME ISOLATION SCORE:
   - Particle phonemes form complete sequence = +3 points
   - Particle phonemes scattered/incomplete = -2 points
   
   C. POSITION FEASIBILITY SCORE:
   - After word boundary (space/pause) = +2 points
   - Mid-word position = -3 points
   - Between phonemes of same word = -5 points
   
   D. FREQUENCY THRESHOLD:
   - Total score ≥6 points = HIGH confidence, place particle
   - Total score 3-5 points = MEDIUM confidence, place with notation
   - Total score <3 points = LOW confidence, reject placement
   
   ALGORITHM:
   1. Calculate timing position percentage through sentence (0-100%)
   2. Map percentage to word boundaries in consensus transcription
   3. Apply mathematical scoring above
   4. Place particles only where score meets threshold
   
   E. ACCENT PROBABILITY SCORING:
   Calculate dominant cultural context using particle frequency:
   
   ACCENT SCORING TABLE:
   - Malaysian/Singaporean: "la", "lor", "ah", "lah" = +1 point each
   - Chinese: "aiya", "wah", "leh" = +1 point each  
   - German: "ja", "doch", "nein" = +1 point each
   - Indian English: "na", "yaar", "hai" = +1 point each
   - Cantonese: "meh", "ga", "la" = +1 point each
   
   DOMINANT ACCENT DETERMINATION:
   - If Malaysian/Singaporean ≥2 points: Apply Malaysian context assumptions
   - If Chinese ≥2 points: Apply Chinese context assumptions
   - If German ≥2 points: Apply German context assumptions
   - If Indian English ≥2 points: Apply Indian English context assumptions
   
   CONTEXT-BASED CORRECTIONS:
   - Malaysian context: Look for "Shannon" → "fashion", "fetch" → "fashion" corrections
   - Chinese context: Look for "guai guai" → "Koi Koi", Chinese names/words
   - German context: Look for German words misheard as English
   - Apply accent-specific phonetic correction patterns to consensus transcription
   
   CRITICAL: If timing suggests a particle but linguistic validation fails, DO NOT force the placement. Only add particles that make conversational sense.
   
   MANDATORY: Your CLEAN TRANSCRIPTION must exactly match the consensus from Steps 1-2. Only add particles to INTEGRATED TRANSCRIPTION if they pass both timing AND linguistic validation.

8. CULTURAL PARTICLE DETECTION:
   
   STRICT VALIDATION: Only add particles that were ACTUALLY identified in Step 3 outlier analysis. Do NOT add particles not found in the outlier phoneme list.
   
   MANDATORY OUTPUT FORMAT - You MUST provide all three transcriptions:
   
   **CLEAN TRANSCRIPTION:** [Standard transcription without cultural markers - suitable for formal/professional use]
   
   **INTEGRATED TRANSCRIPTION:** [Enhanced transcription with cultural particles placed using timing analysis - ONLY particles confirmed in Step 3]
   
   **FINAL TRANSCRIPTION:** [Most natural-sounding version - compare Clean vs Integrated and choose the one that sounds most conversational and realistic]

Please provide a comprehensive analysis with your reasoning, including any detected accent patterns, speech anomalies, and ALWAYS include the INTEGRATED TRANSCRIPTION section."""
        
        # Call Gemini API
        async with aiohttp.ClientSession() as session:
            gemini_result = await orchestrator.call_gemini_api(prompt, session)
        
        return {
            "asr_results": asr_results,
            "gemini_analysis": gemini_result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)