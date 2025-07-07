#!/usr/bin/env python3
"""
ASR Docker Orchestrator - Manages parallel execution of ASR models in Docker containers
with intelligent function calling pipeline for transcription analysis
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
        """Run transcription across multiple ASR models in parallel"""
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
            
            # Run transcription tasks in parallel
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
    
    async def call_gemini_api(self, prompt: str, session: aiohttp.ClientSession, function_declarations: list = None) -> Dict:
        """Call Google Gemini 2.0 Flash API with optional function calling"""
        if not self.gemini_api_key:
            return {"error": "GEMINI_API_KEY not configured"}
        
        generation_config = {
            "temperature": 0.3,
            "topK": 40,
            "topP": 0.95,
            "maxOutputTokens": 4096,
        }
        
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ],
            "generationConfig": generation_config
        }
        
        # Add function calling if provided
        if function_declarations:
            payload["tools"] = [{"function_declarations": function_declarations}]
            payload["tool_config"] = {"function_calling_config": {"mode": "ANY"}}
        
        try:
            async with session.post(
                f"{self.gemini_base_url}?key={self.gemini_api_key}",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    candidate = result.get("candidates", [{}])[0]
                    content = candidate.get("content", {})
                    parts = content.get("parts", [{}])
                    
                    # Check if response contains function calls
                    if parts and "functionCall" in parts[0]:
                        function_call = parts[0]["functionCall"]
                        return {
                            "status": "success",
                            "function_call": {
                                "name": function_call.get("name"),
                                "args": function_call.get("args", {})
                            }
                        }
                    else:
                        # Regular text response
                        return {
                            "status": "success",
                            "response": parts[0].get("text", "") if parts else ""
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

    async def execute_analysis_pipeline(self, asr_results, allosaurus_transcription, allosaurus_timing, context, session):
        """Execute the intelligent function pipeline for transcription analysis"""
        
        # STEP 1: Basic Transcription Consensus
        consensus_functions = [{
            "name": "establish_basic_consensus",
            "description": "Compare ASR models to find initial consensus without web validation",
            "parameters": {
                "type": "object",
                "properties": {
                    "consensus_transcription": {"type": "string", "description": "Most likely correct transcription based on model agreement"},
                    "model_agreement_score": {"type": "number", "description": "Confidence score 0.0-1.0 based on model agreement"},
                    "primary_model": {"type": "string", "description": "ASR model that provided the best base transcription"},
                    "transcription_variants": {"type": "array", "items": {"type": "string"}, "description": "Alternative transcriptions from different models"}
                },
                "required": ["consensus_transcription", "model_agreement_score", "primary_model"]
            }
        }]
        
        consensus_prompt = f"""Analyze these ASR transcription results and establish a basic consensus.

Context: {context}

ASR Results:
{json.dumps(asr_results, indent=2)}

Compare the transcriptions from all successful models and determine:
1. The most likely correct transcription based on common words/phrases
2. Which model performed best
3. Overall confidence in the consensus
4. Alternative transcriptions that might be valid

Call the establish_basic_consensus function with your analysis."""
        
        step1_result = await self.call_gemini_api(consensus_prompt, session, consensus_functions)
        
        if step1_result.get("status") != "success" or "function_call" not in step1_result:
            return {
                "status": "error", 
                "error": "Failed to establish consensus",
                "debug_info": {
                    "step1_result": step1_result,
                    "has_function_call": "function_call" in step1_result,
                    "gemini_status": step1_result.get("status")
                }
            }
        
        consensus_data = step1_result["function_call"]["args"]
        
        # STEP 2: Intelligent Search Term Analysis  
        search_functions = [{
            "name": "identify_search_worthy_terms",
            "description": "Use NLP to identify ambiguous terms, proper nouns, technical words that need web validation",
            "parameters": {
                "type": "object", 
                "properties": {
                    "uncertain_terms": {"type": "array", "items": {"type": "string"}, "description": "Terms with unclear meaning or pronunciation"},
                    "proper_nouns": {"type": "array", "items": {"type": "string"}, "description": "Names, places, brands that need verification"},
                    "technical_terms": {"type": "array", "items": {"type": "string"}, "description": "Specialized vocabulary that might be misheard"},
                    "contextual_ambiguities": {"type": "array", "items": {"type": "string"}, "description": "Words that could have multiple meanings"},
                    "search_queries": {"type": "array", "items": {"type": "string"}, "description": "Specific queries to search for validation"},
                    "search_reasoning": {"type": "string", "description": "Explanation of why these terms need validation"}
                },
                "required": ["uncertain_terms", "proper_nouns", "search_queries", "search_reasoning"]
            }
        }]
        
        search_prompt = f"""Analyze this consensus transcription to identify terms that need web validation.

Consensus Transcription: "{consensus_data['consensus_transcription']}"
Primary Model: {consensus_data['primary_model']}
Agreement Score: {consensus_data['model_agreement_score']}

Use your NLP skills to identify:
- Unclear or ambiguous terms that could be misheard
- Proper nouns (names, places, brands) that need verification  
- Technical terms that might have been transcribed incorrectly
- Words where context is unclear

Only suggest web searches for terms that genuinely need validation. Don't search common words.

Call the identify_search_worthy_terms function with your analysis."""
        
        step2_result = await self.call_gemini_api(search_prompt, session, search_functions)
        
        if step2_result.get("status") != "success" or "function_call" not in step2_result:
            search_data = {"search_queries": [], "search_reasoning": "No terms identified for validation"}
        else:
            search_data = step2_result["function_call"]["args"]
        
        # STEP 3: Targeted Web Validation (if needed)
        web_context = ""
        validated_data = {}
        
        if search_data.get("search_queries"):
            validation_functions = [{
                "name": "validate_with_web_context", 
                "description": "Search identified terms and integrate findings back into transcription",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "validated_corrections": {"type": "object", "description": "Terms that should be corrected based on web search"},
                        "confirmed_proper_nouns": {"type": "array", "items": {"type": "string"}, "description": "Proper nouns confirmed by web search"},
                        "technical_confirmations": {"type": "object", "description": "Technical terms validated or corrected"},
                        "final_consensus": {"type": "string", "description": "Updated transcription with web validation applied"}
                    },
                    "required": ["final_consensus"]
                }
            }]
            
            # Perform web searches
            search_results = []
            for query in search_data["search_queries"][:3]:  # Limit to 3 searches
                result = await self.search_tavily(query, session)
                if result.get("status") == "success":
                    search_results.append({
                        "query": query,
                        "answer": result.get("answer", ""),
                        "results": result.get("results", [])[:2]
                    })
            
            web_context = f"Web Search Results: {json.dumps(search_results, indent=2)}"
            
            validation_prompt = f"""Use these web search results to validate and correct the consensus transcription.

Original Consensus: "{consensus_data['consensus_transcription']}"
Search Terms: {search_data['search_queries']}
Search Reasoning: {search_data['search_reasoning']}

{web_context}

Based on the web search results, determine:
- Which terms should be corrected
- Which proper nouns are confirmed
- The final validated transcription

Call the validate_with_web_context function with your analysis."""
            
            step3_result = await self.call_gemini_api(validation_prompt, session, validation_functions)
            
            if step3_result.get("status") == "success" and "function_call" in step3_result:
                validated_data = step3_result["function_call"]["args"]
            else:
                validated_data = {"final_consensus": consensus_data['consensus_transcription']}
        else:
            validated_data = {"final_consensus": consensus_data['consensus_transcription']}
        
        # STEP 4: Particle Detection (depends on validated consensus)
        particle_functions = [{
            "name": "detect_cultural_particles",
            "description": "Use consensus transcription to map expected phonemes, align with Allosaurus data, and detect/validate cultural particles with strong evidence and correct placement.",
            "parameters": {
                "type": "object",
                "properties": {
                    "base_transcription": {"type": "string", "description": "The validated consensus transcription"},
                    "expected_phonemes": {"type": "array", "items": {"type": "string"}, "description": "Expected IPA phonemes from consensus words (LLM must generate this)"},
                    "outlier_phonemes": {"type": "array", "items": {"type": "string"}, "description": "Phonemes in Allosaurus that don't match expected"},
                    "detected_particles": {"type": "array", "items": {"type": "string"}, "description": "Cultural particles identified from outliers, only if strong evidence and correct placement"},
                    "particle_positions": {"type": "object", "description": "For each detected particle, the word after which it occurs and its timing (e.g., {\"la\": {\"after_word\": \"that\", \"time\": 1.75}})"},
                    "placement_scores": {"type": "object", "description": "Scoring for particle placement validation"},
                    "accent_probability": {"type": "object", "description": "Likelihood of different accent types"}
                },
                "required": ["base_transcription", "expected_phonemes", "outlier_phonemes", "detected_particles", "particle_positions"]
            }
        }]
        
        particle_prompt = f"""Use the validated consensus transcription to detect and place cultural particles from Allosaurus phoneme data.\n\nValidated Consensus: "{validated_data['final_consensus']}"\nAllosaurus Phonemes: {allosaurus_transcription}\nAllosaurus Timing: {json.dumps(allosaurus_timing, indent=2)}\n\nInstructions:\n1. Convert the validated consensus transcription to its expected IPA phoneme sequence (do this yourself, do not assume it is provided).\n2. Align the consensus IPA sequence to the Allosaurus phoneme sequence using timing and word boundaries.\n3. Identify any extra phoneme sequences in Allosaurus that do not match the consensus IPA—these are candidate particles.\n4. Only consider a candidate if it matches a known particle (\"la\"→[l,a], \"lor\"→[l,ɔ,r], \"meh\"→[m,ɛ], \"ah\"→[ɑ], \"ja\"→[j,a], \"na\"→[n,a]) and occurs at a plausible word boundary (e.g., after a word in the consensus).\n5. For each detected particle, record its position (after which word), timing, and confidence.\n6. Avoid false positives: Only add a particle if the evidence is strong.\n\nCall the detect_cultural_particles function with your analysis."""
        
        step4_result = await self.call_gemini_api(particle_prompt, session, particle_functions)
        
        if step4_result.get("status") != "success" or "function_call" not in step4_result:
            particle_data = {"detected_particles": [], "base_transcription": validated_data['final_consensus'], "particle_positions": {}}
        else:
            particle_data = step4_result["function_call"]["args"]
        
        # STEP 5: Final Assembly
        final_functions = [{
            "name": "generate_final_transcriptions",
            "description": "Create clean, integrated, and final versions using all analysis. Provide two integrated versions: (1) strict (only insert particles with strong evidence/position), (2) all_particles (insert all detected particles at plausible positions, even if position/timing is uncertain).",
            "parameters": {
                "type": "object",
                "properties": {
                    "clean_transcription": {"type": "string", "description": "Standard transcription without cultural markers"},
                    "integrated_transcription_strict": {"type": "string", "description": "Enhanced transcription with only strongly validated particles inserted at correct positions (use particle_positions)"},
                    "integrated_transcription_all_particles": {"type": "string", "description": "Transcription with ALL detected particles inserted at plausible positions, even if position/timing is uncertain (fallback to after likely word if needed)"},
                    "final_transcription": {"type": "string", "description": "Most natural-sounding version"},
                    "confidence_score": {"type": "number", "description": "Overall confidence 0.0-1.0"},
                    "accent_analysis": {"type": "string", "description": "Detected accent patterns"}
                },
                "required": ["clean_transcription", "integrated_transcription_strict", "integrated_transcription_all_particles", "final_transcription", "confidence_score"]
            }
        }]
        
        final_prompt = f"""Create the final transcription versions using all pipeline analysis.\n\nPipeline Results:\n- Consensus: "{consensus_data['consensus_transcription']}"  \n- Validated: "{validated_data['final_consensus']}"\n- Detected Particles: {particle_data['detected_particles']} (with positions: {particle_data.get('particle_positions', {})})\n- Web Validation: {web_context != ''}

Instructions:\n1. The "clean" version should not include any cultural particles.\n2. The "integrated_transcription_strict" version should insert only those particles for which you have strong evidence and position (use particle_positions).\n3. The "integrated_transcription_all_particles" version should insert ALL detected particles at plausible positions, even if you are uncertain about timing/position (fallback to after the most likely word, e.g., after 'that' for 'la').\n4. The "final" version should be the most natural-sounding, possibly including particles if they fit naturally.\n5. Only insert particles in the strict version if the evidence is strong.\n\nCall the generate_final_transcriptions function with your analysis."""
        
        step5_result = await self.call_gemini_api(final_prompt, session, final_functions)
        
        if step5_result.get("status") != "success" or "function_call" not in step5_result:
            final_data = {
                "clean_transcription": validated_data['final_consensus'],
                "integrated_transcription_strict": validated_data['final_consensus'],
                "integrated_transcription_all_particles": validated_data['final_consensus'],
                "final_transcription": validated_data['final_consensus'],
                "confidence_score": consensus_data['model_agreement_score']
            }
        else:
            final_data = step5_result["function_call"]["args"]
        
        # Return complete pipeline results
        return {
            "status": "success",
            "pipeline_results": {
                "consensus": consensus_data,
                "search_analysis": search_data,
                "web_validation": validated_data,
                "particle_detection": particle_data,
                "final_output": final_data
            },
            "structured_response": final_data  # For Go autocomplete service
        }

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
    """Transcribe audio using multiple ASR models in parallel"""
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

@app.post("/transcribe-with-gemini")
async def transcribe_with_gemini(
    file: UploadFile = File(...),
    context: str = "Speech recognition analysis",
    models: Optional[str] = None
):
    """Transcribe audio and get Gemini analysis using intelligent function pipeline"""
    try:
        # Get transcription results
        audio_data = await file.read()
        requested_models = [m.strip() for m in models.split(",")] if models else None
        
        asr_results = await orchestrator.transcribe_parallel(
            audio_data, file.filename, requested_models, True
        )
        
        # Extract Allosaurus result specifically for phoneme analysis
        allosaurus_result = asr_results["results"].get("allosaurus", {})
        allosaurus_transcription = allosaurus_result.get("transcription", "") if allosaurus_result.get("status") == "success" else ""
        allosaurus_timing = allosaurus_result.get("timed_phonemes", []) if allosaurus_result.get("status") == "success" else []
        
        # Execute intelligent function pipeline
        async with aiohttp.ClientSession() as session:
            pipeline_results = await orchestrator.execute_analysis_pipeline(
                asr_results, allosaurus_transcription, allosaurus_timing, context, session
            )
        
        return {
            "asr_results": asr_results,
            "gemini_analysis": pipeline_results
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)