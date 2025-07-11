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
import os

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import prompts from organized modules
from prompts import (
    get_consensus_prompt,
    get_search_analysis_prompt, 
    get_validation_prompt,
    get_particle_detection_prompt,
    get_particle_placement_prompt,
    get_final_transcription_prompt
)

# Regional particle sets for accent detection
DISCOURSE_PARTICLES = {
    "southeast_asian": ["la", "lor", "leh", "meh", "sia", "wat", "lah", "aiya", "wah", "aiyo"],
    "british": ["innit", "right", "mate", "cheers", "bloody", "blimey"],
    "indian": ["na", "yaar", "bhai", "re", "hai", "kya", "bas", "arre"],
    "universal": ["ah", "um", "er", "uh", "hmm", "oh", "eh", "ya", "yeah", "okay"]
}

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
    """
    ═══════════════════════════════════════════════════════════════════════════════════
    ASR ORCHESTRATOR - Main class managing the 5-step intelligent transcription pipeline
    ═══════════════════════════════════════════════════════════════════════════════════
    
    Pipeline Overview:
    1. ASR Transcription (Parallel) - All models transcribe simultaneously
    2. Consensus Analysis - Establish basic consensus from model results  
    3. Search Analysis - Identify uncertain terms needing web validation
    4. Web Validation - Search and validate uncertain terms
    5. Particle Detection - Use phonemizer + LLM for cultural particle detection
    6. Final Integration - Combine all results into final transcription
    """
    
    def __init__(self):
        # ═════════════════════════════════════════════════════════════════════════════
        # API CONFIGURATION SECTION
        # ═════════════════════════════════════════════════════════════════════════════
        
        # Gemini API configuration
        self.gemini_api_key = os.getenv("GEMINI_API_KEY")
        self.gemini_base_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent"
        
        # Tavily API configuration for web search
        self.tavily_api_key = os.getenv("TAVILY_API_KEY")
        self.tavily_base_url = "https://api.tavily.com/search"
        
        # ═════════════════════════════════════════════════════════════════════════════
        # ASR MODEL SERVICES CONFIGURATION
        # ═════════════════════════════════════════════════════════════════════════════
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
        
    # ═════════════════════════════════════════════════════════════════════════════
    # HELPER METHODS: ASR TRANSCRIPTION (PARALLEL EXECUTION)
    # ═════════════════════════════════════════════════════════════════════════════
    
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
    
    # ═════════════════════════════════════════════════════════════════════════════
    # GEMINI API INTEGRATION FOR INTELLIGENT ANALYSIS
    # ═════════════════════════════════════════════════════════════════════════════
    
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
    
    # ═════════════════════════════════════════════════════════════════════════════
    # HELPER METHODS: WEB SEARCH VALIDATION (TAVILY INTEGRATION)
    # ═════════════════════════════════════════════════════════════════════════════
    
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
    

    # ═════════════════════════════════════════════════════════════════════════════
    # HELPER METHODS: PHONEMIZER & DATA PREPARATION
    # ═════════════════════════════════════════════════════════════════════════════
    
    def get_expected_phonemes(self, text: str) -> List[str]:
        """Get expected phonemes from text using phonemizer with espeak-ng backend"""
        try:
            from phonemizer import phonemize
            
            # Use espeak-ng backend for consistency with many ASR systems
            phoneme_string = phonemize(
                text,
                backend='espeak',
                language='en-us',
                strip=True,
                preserve_punctuation=False,
                with_stress=False  # Disable stress marks for simpler comparison
            )
            # Split into individual phonemes and clean
            phonemes = []
            for word_phonemes in phoneme_string.split():
                phonemes.extend(word_phonemes.split())
            
            # Remove empty strings and normalize
            return [p.strip() for p in phonemes if p.strip()]
            
        except Exception as e:
            # Fallback: return empty list if phonemizer fails
            print(f"Phonemizer error: {e}")
            return []

    def prepare_particle_analysis_data(self, consensus_text: str, allosaurus_phonemes: List[str], timing_data: List[Dict]) -> Dict:
        """Prepare data for pure LLM-based particle detection"""
        
        # Get expected phonemes from consensus text using phonemizer
        expected_phonemes = self.get_expected_phonemes(consensus_text)
        
        print(f"DEBUG: Timing data length: {len(timing_data)}")
        print(f"DEBUG: Input text for phonemizer: '{consensus_text}'")
        print(f"DEBUG: Expected phonemes from phonemizer: {expected_phonemes}")
        
        # Calculate basic speech metrics for LLM context
        total_duration = timing_data[-1]['end_time'] - timing_data[0]['start_time'] if timing_data else 0
        speech_rate = len(allosaurus_phonemes) / total_duration if total_duration > 0 else 0
        
        print(f"DEBUG: Speech rate: {speech_rate:.2f} phonemes/second")
        print(f"DEBUG: Total duration: {total_duration:.2f} seconds")
        print(f"DEBUG: Sending raw timing data to LLM for intelligent particle analysis")
        
        # Return complete raw data for pure LLM analysis - no algorithmic assumptions
        return {
            'consensus_text': consensus_text,
            'expected_phonemes': expected_phonemes,
            'allosaurus_phonemes': allosaurus_phonemes,
            'timing_data': timing_data,  # Raw timing data for LLM to analyze
            'speech_metrics': {
                'total_duration': total_duration,
                'speech_rate': speech_rate,
                'phoneme_count': len(allosaurus_phonemes)
            },
            # Let LLM determine outliers and particles from raw data
            'outlier_phonemes': [],
            'detected_particles': [],
            'particle_details': []
        }

    # ═════════════════════════════════════════════════════════════════════════════
    # MAIN PIPELINE: 5-STEP INTELLIGENT TRANSCRIPTION ANALYSIS
    # ═════════════════════════════════════════════════════════════════════════════
    
    async def execute_analysis_pipeline(self, asr_results, allosaurus_transcription, allosaurus_timing, context, session):
        """Execute the intelligent function pipeline for transcription analysis"""
        
        # ─────────────────────────────────────────────────────────────────────────────
        # STEP 1: BASIC TRANSCRIPTION CONSENSUS
        # ─────────────────────────────────────────────────────────────────────────────
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
        
        consensus_prompt = get_consensus_prompt(json.dumps(asr_results, indent=2), context)
        
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
        print(f"DEBUG: Step 1 consensus result: {consensus_data}")
        
        # ─────────────────────────────────────────────────────────────────────────────
        # STEP 2: INTELLIGENT SEARCH TERM ANALYSIS
        # ─────────────────────────────────────────────────────────────────────────────  
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
        
        search_prompt = get_search_analysis_prompt(consensus_data['consensus_transcription'], context)
        
        step2_result = await self.call_gemini_api(search_prompt, session, search_functions)
        
        if step2_result.get("status") != "success" or "function_call" not in step2_result:
            search_data = {"search_queries": [], "search_reasoning": "No terms identified for validation"}
        else:
            search_data = step2_result["function_call"]["args"]
        
        # ─────────────────────────────────────────────────────────────────────────────
        # STEP 3: TARGETED WEB VALIDATION (if needed)
        # ─────────────────────────────────────────────────────────────────────────────
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
            
            validation_prompt = get_validation_prompt(consensus_data, search_data, web_context)
            
            step3_result = await self.call_gemini_api(validation_prompt, session, validation_functions)
            
            if step3_result.get("status") == "success" and "function_call" in step3_result:
                validated_data = step3_result["function_call"]["args"]
                # Defensive: ensure 'final_consensus' is present before any use
                if "final_consensus" not in validated_data:
                    validated_data["final_consensus"] = consensus_data['consensus_transcription']
            else:
                validated_data = {"final_consensus": consensus_data['consensus_transcription']}
        else:
            validated_data = {"final_consensus": consensus_data['consensus_transcription']}
        
        # ─────────────────────────────────────────────────────────────────────────────
        # STEP 4: TWO-PHASE CULTURAL PARTICLE DETECTION WITH PURE IPA INTERPRETATION
        # ─────────────────────────────────────────────────────────────────────────────
        print("DEBUG: Starting STEP 4 - Two-Phase Particle Detection (IPA Interpretation + Placement)")
        
        # Prepare raw timing data for LLM analysis (no algorithmic grouping/assumptions)
        allosaurus_phonemes_list = allosaurus_transcription.split() if allosaurus_transcription else []
        particle_analysis = self.prepare_particle_analysis_data(
            validated_data['final_consensus'], 
            allosaurus_phonemes_list, 
            allosaurus_timing
        )
        
        print(f"DEBUG: Particle analysis result: {particle_analysis}")
        
        # ─────────────────────────────────────────────────────────────────────────────
        # STEP 4A: DISCOURSE PARTICLE DETECTION IN IPA PHONEMES
        # ─────────────────────────────────────────────────────────────────────────────
        print("DEBUG: Starting STEP 4A - Discourse Particle Detection in IPA")
        
        # Function to find discourse particles in IPA phonemes
        ipa_interpretation_functions = [{
            "name": "find_discourse_particles",
            "parameters": {
                "type": "object",
                "properties": {
                    "particles_found": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "particle": {"type": "string"},
                                "ipa": {"type": "string"},
                                "confidence": {"type": "number"},
                                "word_index": {"type": "number"},
                                "character_position": {"type": "number"},
                                "region": {"type": "string"}
                            },
                            "required": ["particle", "ipa", "confidence", "word_index", "character_position", "region"]
                        }
                    }
                },
                "required": ["particles_found"]
            }
        }]
        
        # Create concise timing summary instead of full JSON
        timing_summary = []
        for i, phoneme_data in enumerate(allosaurus_timing):
            timing_summary.append(f"{i}: {phoneme_data['phoneme']} at {phoneme_data['start_time']:.2f}s")
        
        # Generate particle detection prompt
        ipa_prompt = get_particle_detection_prompt(
            DISCOURSE_PARTICLES,
            particle_analysis['allosaurus_phonemes'],
            timing_summary,
            particle_analysis['timing_data'],
            validated_data['final_consensus']
        )
        
        step4a_result = await self.call_gemini_api(ipa_prompt, session, ipa_interpretation_functions)
        
        print(f"DEBUG: Step 4A raw result: {step4a_result}")
        
        if step4a_result.get("status") == "success" and "function_call" in step4a_result:
            ipa_interpretation = step4a_result["function_call"]["args"]
            print(f"DEBUG: IPA particle detection result: {ipa_interpretation}")
        else:
            # Fallback: no particles found
            ipa_interpretation = {
                "particles_found": []
            }
            print(f"DEBUG: IPA particle detection failed, using fallback. Error: {step4a_result.get('error', 'Unknown error')}")
        
        # ─────────────────────────────────────────────────────────────────────────────
        # STEP 4B: PLACEMENT ANALYSIS WITH FULL CONTEXT (IPA + CONSENSUS + EXPECTED)
        # ─────────────────────────────────────────────────────────────────────────────
        print("DEBUG: Starting STEP 4B - Placement Analysis with Full Context")
        
        # Function to analyze placement using all available data
        placement_analysis_functions = [{
            "name": "analyze_particle_placement",
            "description": "Analyze where particles should be placed by comparing IPA interpretation with consensus transcription",
            "parameters": {
                "type": "object",
                "properties": {
                    "detected_particles": {"type": "array", "items": {"type": "string"}, "description": "Particles detected in the speech"},
                    "particle_positions": {"type": "object", "description": "For each particle, the word after which it occurs"},
                    "placement_reasoning": {"type": "string", "description": "Explanation of placement decisions"}
                },
                "required": ["detected_particles", "particle_positions", "placement_reasoning"]
            }
        }]
        
        print("DEBUG: validated_data before placement prompt:", validated_data)
        if 'final_consensus' not in validated_data:
            validated_data['final_consensus'] = consensus_data['consensus_transcription']
        # Generate particle placement prompt
        placement_prompt = get_particle_placement_prompt(
            validated_data, 
            particle_analysis, 
            ipa_interpretation, 
            DISCOURSE_PARTICLES, 
            allosaurus_timing
        )
        
        step4b_result = await self.call_gemini_api(placement_prompt, session, placement_analysis_functions)
        
        if step4b_result.get("status") == "success" and "function_call" in step4b_result:
            placement_data = step4b_result["function_call"]["args"]
            particle_data = {
                "base_transcription": validated_data['final_consensus'],
                "expected_phonemes": particle_analysis['expected_phonemes'],
                "outlier_phonemes": particle_analysis['outlier_phonemes'],
                "detected_particles": placement_data.get('detected_particles', []),
                "particle_positions": placement_data.get('particle_positions', {}),
                "ipa_interpretation": ipa_interpretation,
                "placement_reasoning": placement_data.get('placement_reasoning', '')
            }
        else:
            # Fallback: no particles detected
            particle_data = {
                "base_transcription": validated_data['final_consensus'],
                "expected_phonemes": particle_analysis['expected_phonemes'],
                "outlier_phonemes": particle_analysis['outlier_phonemes'], 
                "detected_particles": [],
                "particle_positions": {},
                "ipa_interpretation": ipa_interpretation
            }
        
        # ─────────────────────────────────────────────────────────────────────────────
        # STEP 5: FINAL TRANSCRIPTION ASSEMBLY
        # ─────────────────────────────────────────────────────────────────────────────
        final_functions = [{
            "name": "generate_final_transcription",
            "description": "Create the best possible transcription using all pipeline analysis, incorporating detected particles where appropriate.",
            "parameters": {
                "type": "object",
                "properties": {
                    "final_transcription": {"type": "string", "description": "Best transcription incorporating consensus, web validation, and particles"},
                    "integrated_transcription_all_particles": {"type": "string", "description": "Version with ALL detected particles inserted at appropriate positions"},
                    "confidence_score": {"type": "number", "description": "Overall confidence 0.0-1.0"}
                },
                "required": ["final_transcription", "integrated_transcription_all_particles", "confidence_score"]
            }
        }]
        
        # Defensive: ensure 'final_consensus' is present before final transcription prompt
        if 'final_consensus' not in validated_data:
            validated_data['final_consensus'] = consensus_data['consensus_transcription']
        # Generate final transcription prompt
        final_prompt = get_final_transcription_prompt(
            consensus_data,
            search_data,
            validated_data,
            particle_data
        )
        
        step5_result = await self.call_gemini_api(final_prompt, session, final_functions)
        
        if step5_result.get("status") != "success" or "function_call" not in step5_result:
            final_data = {
                "final_transcription": validated_data['final_consensus'],
                "integrated_transcription_all_particles": validated_data['final_consensus'],
                "confidence_score": consensus_data['model_agreement_score']
            }
        else:
            final_data = step5_result["function_call"]["args"]
        
        # Extract primary transcription (best result from Gemini pipeline)
        primary_transcription = final_data.get('integrated_transcription_all_particles', 
                                             final_data.get('final_transcription', 
                                                           validated_data['final_consensus']))
        
        # Return clean structure for corpus validation researchers
        return {
            "status": "success",
            "primary": validated_data['final_consensus'],  # Clean transcript without particles
            "alternatives": {
                model: result.get('transcription', '') 
                for model, result in asr_results['results'].items() 
                if result.get('status') == 'success' and model != 'allosaurus'
            },
            "potential_particles": ipa_interpretation.get('particles_found', []),
            "metadata": {
                "confidence": final_data.get('confidence_score', consensus_data['model_agreement_score']),
                "processing_time": asr_results.get('total_processing_time', 0),
                "models_used": asr_results.get('successful_models', 0)
            },
        }

# Create FastAPI app
# ═══════════════════════════════════════════════════════════════════════════════════
# FASTAPI WEB SERVICE - HTTP ENDPOINTS FOR ASR ORCHESTRATION
# ═══════════════════════════════════════════════════════════════════════════════════

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
    models: Optional[str] = None  # Comma-separated model names
):
    """Transcribe audio using multiple ASR models - returns clean transcriptions for autocorrect"""
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
            include_diagnostics=True  # Need full results to extract transcriptions
        )
        
        # Always return clean transcriptions only
        return {
            model: result.get('transcription', '') 
            for model, result in results['results'].items() 
            if result.get('status') == 'success'
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transcribe-with-gemini")
async def transcribe_with_gemini(
    file: UploadFile = File(...),
    context: str = "Speech recognition analysis",
    models: Optional[str] = None
):
    """Transcribe audio and get clean Gemini analysis for corpus validation"""
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
        allosaurus_timing = allosaurus_result.get("diagnostics", {}).get("timed_phonemes", []) if allosaurus_result.get("status") == "success" else []
        
        # Execute intelligent function pipeline (clean mode)
        async with aiohttp.ClientSession() as session:
            pipeline_results = await orchestrator.execute_analysis_pipeline(
                asr_results, allosaurus_transcription, allosaurus_timing, context, session
            )
        
        # Return clean results (pipeline_results already formatted for researchers)
        return pipeline_results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transcribe-with-gemini/debug")
async def transcribe_with_gemini_debug(
    file: UploadFile = File(...),
    context: str = "Speech recognition analysis", 
    models: Optional[str] = None
):
    """Transcribe audio with full diagnostic information for debugging"""
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
        allosaurus_timing = allosaurus_result.get("diagnostics", {}).get("timed_phonemes", []) if allosaurus_result.get("status") == "success" else []
        
        # Execute intelligent function pipeline (debug mode)
        async with aiohttp.ClientSession() as session:
            pipeline_results = await orchestrator.execute_analysis_pipeline(
                asr_results, allosaurus_transcription, allosaurus_timing, context, session
            )
        
        # Return full diagnostic information
        return {
            "asr_results": asr_results,
            "gemini_analysis": pipeline_results,
            "system_info": {
                "filename": file.filename,
                "context": context,
                "models_requested": requested_models or list(orchestrator.model_services.keys()),
                "allosaurus_timing_entries": len(allosaurus_timing)
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transcribe/debug") 
async def transcribe_audio_debug(
    file: UploadFile = File(...),
    models: Optional[str] = None
):
    """Transcribe audio with full ASR diagnostic information"""
    try:
        # Read audio file
        audio_data = await file.read()
        requested_models = [m.strip() for m in models.split(",")] if models else None
        
        # Run parallel transcription with full diagnostics
        results = await orchestrator.transcribe_parallel(
            audio_data, file.filename, requested_models, True
        )
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)