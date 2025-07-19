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

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
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

# Comprehensive discourse particle sets for accent detection
DISCOURSE_PARTICLES = {
    # Specific Southeast Asian variants
    "malaysian": ["la", "lor", "leh", "mah", "wan", "kan", "ya", "cis", "wei", "nia"],
    "singaporean": ["lah", "leh", "lor", "meh", "sia", "ceh", "hor", "what", "liao", "arh"],
    "filipino": ["po", "opo", "ano", "kasi", "naman"],
    
    # Combined regional sets
    "southeast_asian_combined": ["la", "lor", "leh", "mah", "wan", "kan", "ya", "cis", "wei", "nia", "lah", "meh", "sia", "ceh", "hor", "what", "liao", "arh", "po", "opo", "ano", "kasi", "naman"],
    
    # Specific North American variants
    "american": ["dude", "awesome", "totally", "gonna", "wanna", "like", "you know", "whatever"],
    "canadian": ["eh", "about", "sorry", "hoser", "double-double", "toque", "loonie", "toonie"],
    "north_american_combined": ["dude", "awesome", "totally", "gonna", "wanna", "eh", "about", "sorry", "hoser", "double-double"],
    
    # Specific British Isles variants
    "british": ["innit", "mate", "cheers", "blimey", "brilliant"],
    "irish": ["craic", "grand", "feck", "sound", "banter", "fair play", "deadly", "class"],
    "scottish": ["aye", "wee", "ken", "bonnie", "dinnae", "cannae", "och", "blether"],
    "british_isles_combined": ["innit", "mate", "cheers", "blimey", "brilliant", "craic", "grand", "feck", "sound", "aye", "wee", "ken"],
    
    # Specific Oceanic variants
    "australian": ["mate", "bloody", "fair dinkum", "no worries", "crikey", "g'day", "she'll be right"],
    "new_zealand": ["choice", "yeah nah", "sweet as", "bro", "chur", "she'll be right", "good as gold"],
    "oceanic_combined": ["mate", "bloody", "fair dinkum", "no worries", "crikey", "choice", "yeah nah", "sweet as", "bro", "chur"],
    
    # Other individual variants
    "indian": ["na", "yaar", "bhai", "achha", "bas"],
    "south_african": ["ag", "boet", "lekker", "shame", "braai", "eish", "howzit", "ja"],
    "jamaican": ["bredrin", "big up", "irie", "seen", "wha gwaan"],
    
    # Middle Eastern variants
    "lebanese": ["yalla", "habibi", "khalas", "inshallah", "mashallah"],
    "emirati": ["yalla", "habibi", "khalas", "wallah", "mashallah"],
    "middle_eastern_combined": ["yalla", "habibi", "khalas", "inshallah", "mashallah", "wallah"],
    
    # Special cases
    "unknown": ["ah", "um", "er", "uh", "hmm", "oh", "eh", "ya", "yeah", "okay"],
    "none": []
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
    ASR ORCHESTRATOR - Two-Stage Human-in-the-Loop Transcription Pipeline
    ═══════════════════════════════════════════════════════════════════════════════════
    
    STAGE 1: CONSENSUS PIPELINE (/transcribe-consensus)
    ──────────────────────────────────────────────────
    1. Parallel ASR Transcription - All models transcribe simultaneously
    2. Consensus Analysis - Establish basic consensus from model results  
    3. Search Analysis - Identify uncertain terms needing web validation
    4. Web Validation - Search and validate uncertain terms
    → Returns: consensus transcription + alternatives for user validation
    
    STAGE 2: PARTICLE DETECTION PIPELINE (/transcribe-with-particles)
    ───────────────────────────────────────────────────────────────────
    5. Accent-Specific Particle Detection - LLM identifies cultural particles
    6. Particle Placement Analysis - Determine optimal particle positioning
    7. Final Integration - Combine validated consensus with detected particles
    → Returns: accent-aware transcription with cultural particles
    
    ARCHITECTURE BENEFITS:
    • Human validation between stages improves accuracy
    • Accent selection enables targeted particle detection
    • Modular design allows independent stage optimization
    • Supports both automated and human-guided workflows
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
    # STAGE 1: CONSENSUS PIPELINE IMPLEMENTATION
    # ═════════════════════════════════════════════════════════════════════════════
    
    async def execute_consensus_pipeline(self, asr_results, allosaurus_transcription, allosaurus_timing, context, session, ground_truth=None):
        """Execute only the consensus and validation steps - stops before particle detection"""
        
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
        
        consensus_prompt = get_consensus_prompt(json.dumps(asr_results, indent=2), context, ground_truth)
        
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
        
        search_prompt = get_search_analysis_prompt(consensus_data['consensus_transcription'], context, asr_results.get("results", {}))
        
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
                "description": "Use web search results to validate uncertain terms and improve transcription accuracy",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "validated_terms": {"type": "object", "description": "Terms that were validated with web search"},
                        "corrections_made": {"type": "array", "items": {"type": "string"}, "description": "Specific corrections applied"},
                        "final_consensus": {"type": "string", "description": "Final transcription after web validation"},
                        "validation_confidence": {"type": "number", "description": "Confidence in validation 0.0-1.0"},
                        "web_evidence": {"type": "array", "items": {"type": "string"}, "description": "Supporting evidence from web search"}
                    },
                    "required": ["validated_terms", "corrections_made", "final_consensus", "validation_confidence"]
                }
            }]
            
            # Perform web searches
            search_results = []
            for query in search_data["search_queries"]:
                try:
                    result = await self.search_tavily(query, session)
                    search_results.append({"query": query, "result": result})
                except Exception as e:
                    print(f"DEBUG: Web search failed for query '{query}': {e}")
                    search_results.append({"query": query, "result": {"error": str(e)}})
            
            web_context = json.dumps(search_results, indent=2)
            validation_prompt = get_validation_prompt(consensus_data, search_data, web_context)
            
            step3_result = await self.call_gemini_api(validation_prompt, session, validation_functions)
            
            if step3_result.get("status") == "success" and "function_call" in step3_result:
                validated_data = step3_result["function_call"]["args"]
            else:
                validated_data = {
                    "validated_terms": {},
                    "corrections_made": [],
                    "final_consensus": consensus_data['consensus_transcription'],
                    "validation_confidence": consensus_data['model_agreement_score']
                }
        else:
            validated_data = {
                "validated_terms": {},
                "corrections_made": [],
                "final_consensus": consensus_data['consensus_transcription'],
                "validation_confidence": consensus_data['model_agreement_score']
            }
        
        # Prepare A-B pronoun consolidation choices
        pronoun_consolidation = {
            "option_a": {
                "transcription": consensus_data['consensus_transcription'],
                "label": "AI Consensus",
                "description": f"Based on agreement between {asr_results.get('successful_models', 6)} speech recognition models",
                "confidence": consensus_data['model_agreement_score'],
                "reasoning": f"Primary model: {consensus_data['primary_model']}"
            },
            "option_b": {
                "transcription": validated_data['final_consensus'],
                "label": "With Spelling Context",
                "description": "AI consensus with proper noun spelling verification",
                "confidence": validated_data['validation_confidence'],
                "reasoning": self._format_search_explanations(search_data, validated_data)
            }
        }
        
        print(f"DEBUG: Created pronoun_consolidation: {pronoun_consolidation}")
        print(f"DEBUG: Option A transcription: '{pronoun_consolidation['option_a']['transcription']}'")
        print(f"DEBUG: Option B transcription: '{pronoun_consolidation['option_b']['transcription']}'")
        print(f"DEBUG: Are they different? {pronoun_consolidation['option_a']['transcription'] != pronoun_consolidation['option_b']['transcription']}")
        
        # Return consensus result with A-B choices
        result = {
            "status": "success",
            "primary": consensus_data['consensus_transcription'],  # Keep for backward compatibility
            "pronoun_consolidation": pronoun_consolidation,  # New A-B choice system
            "alternatives": {
                model: result.get('transcription', '')
                for model, result in asr_results['results'].items()
                if result.get('status') == 'success' and model != 'allosaurus'
            },
            "consensus_data": consensus_data,
            "validation_data": validated_data,  # Use validation_data to match current API response
            "search_data": search_data,
            "asr_results": asr_results,
            "metadata": {
                "confidence": consensus_data['model_agreement_score'],
                "processing_time": asr_results.get('total_processing_time', 0),
                "models_used": asr_results.get('successful_models', 0)
            },
            "audio_filename": asr_results.get('audio_filename', '')
        }
        
        # Add autocomplete-ready data extraction
        result["autocomplete_data"] = self.extract_autocomplete_data(result)
        
        # Don't auto-push to autocomplete service - wait for user decision
        
        return result

    def _format_search_explanations(self, search_data, validated_data):
        """Format search explanations for user display"""
        explanations = []
        
        # Add search queries that were performed
        if search_data.get('search_queries'):
            explanations.append(f"Verified Search Terms: {', '.join(search_data['search_queries'])}")
        
        # Add validated terms
        if validated_data.get('validated_terms'):
            validated_terms = validated_data['validated_terms']
            if validated_terms:
                explanations.append(f"Confirmed: {', '.join(validated_terms.keys())}")
        
        # Add corrections made
        if validated_data.get('corrections_made'):
            corrections = validated_data['corrections_made']
            if corrections:
                explanations.append(f"Corrected: {', '.join(corrections)}")
        
        # Default explanation if no specific search was performed
        if not explanations:
            explanations.append("No proper nouns requiring web verification found")
        
        return " • ".join(explanations)
    
    def extract_autocomplete_data(self, consensus_result):
        """Extract minimal data structure for autocomplete service"""
        return {
            "final_transcription": consensus_result.get("primary", ""),
            "confidence_score": consensus_result.get("metadata", {}).get("confidence", 0.0),
            "detected_particles": [],  # Will be populated by particle detection stage
            "asr_alternatives": consensus_result.get("alternatives", {})
        }
    
    async def push_to_autocomplete_service(self, autocomplete_data, audio_filename):
        """Push data directly to Go autocomplete service"""
        import aiohttp
        import os
        
        autocomplete_url = os.getenv("AUTOCOMPLETE_URL", "http://autocomplete-service:8007")
        
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{autocomplete_url}/initialize"  # No audio_id needed
                async with session.post(url, json=autocomplete_data) as response:
                    if response.status == 200:
                        print(f"DEBUG: Successfully pushed data to autocomplete service")
                    else:
                        print(f"DEBUG: Failed to push to autocomplete service: {response.status}")
        except Exception as e:
            print(f"DEBUG: Error pushing to autocomplete service: {e}")
            # Don't fail the main request if autocomplete push fails

    # ═════════════════════════════════════════════════════════════════════════════
    # STAGE 2: PARTICLE DETECTION PIPELINE IMPLEMENTATION
    # ═════════════════════════════════════════════════════════════════════════════
    
    async def detect_discourse_particles_with_ipa(self, consensus_result, allosaurus_transcription, allosaurus_timing, context, session, human_particles=None, accent_hint=None):
        """Detect discourse particles using IPA analysis and accent filtering"""
        
        consensus_transcription = consensus_result.get("consensus_transcription", "")
        
        # Prepare raw timing data for analysis
        allosaurus_phonemes_list = allosaurus_transcription.split() if allosaurus_transcription else []
        particle_analysis = self.prepare_particle_analysis_data(
            consensus_transcription,
            allosaurus_phonemes_list,
            allosaurus_timing
        )
        
        print(f"DEBUG: Particle analysis result: {particle_analysis}")
        
        # Filter particles based on accent hint early
        print(f"DEBUG: Received accent_hint: '{accent_hint}'")
        print(f"DEBUG: Available accent keys: {list(DISCOURSE_PARTICLES.keys())}")
        
        if accent_hint and accent_hint in DISCOURSE_PARTICLES:
            accent_particles = {accent_hint: DISCOURSE_PARTICLES[accent_hint]}
            print(f"DEBUG: Using accent-specific particles for {accent_hint}: {accent_particles[accent_hint]}")
        else:
            accent_particles = DISCOURSE_PARTICLES
            print(f"DEBUG: No valid accent hint ('{accent_hint}'), using all particles: {list(DISCOURSE_PARTICLES.keys())}")
        
        # Check if human particles were provided
        if human_particles:
            print("DEBUG: Using human-provided particle selections")
            # Use human particle selections directly
            return {
                "potential_particles": human_particles.get('particles', []),
                "particle_positions": human_particles.get('positions', {}),
                "reasoning": "Human-selected particles"
            }
        else:
            print("DEBUG: Using LLM particle detection as fallback")
            
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
                        },
                        "llm_recommended_transcription": {"type": "string"}
                    },
                    "required": ["particles_found", "llm_recommended_transcription"]
                }
            }]
            
            # Create concise timing summary instead of full JSON
            timing_summary = []
            for i, phoneme_data in enumerate(allosaurus_timing):
                timing_summary.append(f"{i}: {phoneme_data['phoneme']} at {phoneme_data['start_time']:.2f}s")
            
            # Generate particle detection prompt with accent-specific particles
            print(f"DEBUG: Particles being sent to LLM: {accent_particles}")
            print(f"DEBUG: Consensus transcript: {consensus_transcription}")
            
            ipa_prompt = get_particle_detection_prompt(
                accent_particles,
                particle_analysis['allosaurus_phonemes'],
                timing_summary,
                particle_analysis['timing_data'],
                consensus_transcription
            )
            
            step4a_result = await self.call_gemini_api(ipa_prompt, session, ipa_interpretation_functions)
            
            print(f"DEBUG: Step 4A raw result: {step4a_result}")
            
            if step4a_result.get("status") == "success" and "function_call" in step4a_result:
                ipa_interpretation = step4a_result["function_call"]["args"]
                print(f"DEBUG: IPA particle detection result: {ipa_interpretation}")
                return {
                    "potential_particles": ipa_interpretation.get('particles_found', []),
                    "llm_recommended_transcription": ipa_interpretation.get('llm_recommended_transcription', ''),
                    "reasoning": "LLM-detected particles"
                }
            else:
                # Fallback: no particles found
                print(f"DEBUG: IPA particle detection failed, using fallback. Error: {step4a_result.get('error', 'Unknown error')}")
                return {
                    "potential_particles": [],
                    "llm_recommended_transcription": "",
                    "reasoning": "No particles detected"
                }
        
        # For human_particles fallback
        if human_particles:
            return {
                "potential_particles": human_particles.get('particles', []),
                "particle_positions": human_particles.get('positions', {}),
                "reasoning": "Human-selected particles",
                "llm_recommended_transcription": ""
            }

    async def execute_particle_detection_only(self, consensus_transcription, asr_generated_phonemes, allosaurus_timing, context, session, human_particles=None, accent_hint=None):
        """Execute ONLY step 4 (particle detection) using cached consensus data"""
        start_time = time.time()
        
        print(f"DEBUG: Starting particle detection only pipeline")
        print(f"DEBUG: consensus_transcription: '{consensus_transcription}'")
        print(f"DEBUG: accent_hint: '{accent_hint}'")
        
        # Skip steps 1-3, go directly to step 4
        print(f"DEBUG: Starting STEP 4 - Particle Detection (Human-in-the-loop or LLM)")
        print(f"DEBUG: Timing data length: {len(allosaurus_timing)}")
        
        # Step 4: Particle Detection and Placement
        consensus_result = {
            "consensus_transcription": consensus_transcription,
            "transcription_variants": [],  # Not needed for particle detection
            "primary_model": "cached",
            "model_agreement_score": 1.0  # Assume consensus from cache
        }
        
        particle_results = await self.detect_discourse_particles_with_ipa(
            consensus_result, asr_generated_phonemes, allosaurus_timing, context, session, human_particles, accent_hint
        )
        
        processing_time = time.time() - start_time
        
        return {
            "status": "success",
            "primary": consensus_transcription,
            "alternatives": {},  # Not recalculated in particle-only mode
            "potential_particles": particle_results.get("potential_particles", []),
            "metadata": {
                "confidence": 0.95,  # High confidence since using cached consensus
                "processing_time": processing_time,
                "models_used": 0,  # No ASR models used in particle-only mode
                "stage": "particle_detection_only"
            },
            "particle_analysis": particle_results
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

@app.post("/transcribe-consensus")
async def transcribe_consensus(
    file: UploadFile = File(...),
    context: str = Form("Speech recognition consensus analysis"),
    models: Optional[str] = Form(None),
    ground_truth: Optional[str] = Form(None)
):
    """STAGE 1: Consensus Pipeline - Get consensus transcription with alternatives for human validation"""
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
        
        # Execute STAGE 1: Consensus pipeline only
        async with aiohttp.ClientSession() as session:
            consensus_results = await orchestrator.execute_consensus_pipeline(
                asr_results, allosaurus_transcription, allosaurus_timing, context, session, ground_truth
            )
        
        # Add asr_generated_phonemes to the response
        consensus_results["asr_generated_phonemes"] = allosaurus_transcription.split() if allosaurus_transcription else []
        
        # If ground truth provided (practice mode), add comparison metadata
        if ground_truth:
            consensus_results["ground_truth"] = ground_truth
            consensus_results["is_practice_mode"] = True
            
            # Add comparison metrics for educational purposes
            asr_primary = consensus_results.get("primary", "")
            consensus_results["accuracy_comparison"] = {
                "ground_truth": ground_truth,
                "asr_result": asr_primary,
                "match": ground_truth.lower().strip() == asr_primary.lower().strip(),
                "word_count_diff": len(ground_truth.split()) - len(asr_primary.split())
            }
            
            # For practice mode, create educational pronoun consolidation choices
            # Option A: ASR result, Option B: Ground truth
            consensus_results["pronoun_consolidation"] = {
                "option_a": asr_primary,
                "option_b": ground_truth,
                "educational_note": "Compare ASR output with validated transcription"
            }
        
        return consensus_results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AutocompleteInitRequest(BaseModel):
    final_transcription: str
    confidence_score: float = 0.8
    detected_particles: List[str] = []
    asr_alternatives: Dict[str, str] = {}

@app.post("/initialize-autocomplete")
async def initialize_autocomplete(request: AutocompleteInitRequest):
    """Initialize autocomplete service with transcription data when user chooses to edit"""
    try:
        # Prepare data for autocomplete service
        autocomplete_data = {
            "final_transcription": request.final_transcription,
            "confidence_score": request.confidence_score,
            "detected_particles": request.detected_particles,
            "asr_alternatives": request.asr_alternatives
        }
        
        # Push to autocomplete service
        await orchestrator.push_to_autocomplete_service(autocomplete_data, "audio_file")
        
        return {
            "status": "success",
            "message": "Autocomplete service initialized",
            "data": autocomplete_data
        }
        
    except Exception as e:
        print(f"Error in initialize-autocomplete: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transcribe-with-particles")
async def transcribe_with_particles(
    consensus_data: str = Form(...),  # JSON string of consensus results from first pipeline
    context: str = Form("Speech recognition analysis"),
    accent_hint: Optional[str] = Form(None),  # Accent selection from frontend
    human_particles: Optional[str] = Form(None)  # JSON string of human particle selections
):
    """Particle detection pipeline using cached consensus data from first pipeline, now with full LLM integration (steps 4B and 5)"""
    try:
        print(f"DEBUG: /transcribe-with-particles called with:")
        print(f"  - context: {context}")
        print(f"  - accent_hint: '{accent_hint}' (type: {type(accent_hint)})")
        print(f"  - human_particles: {human_particles}")
        print(f"  - consensus_data length: {len(consensus_data) if consensus_data else 0}")
        
        # Parse the consensus data from the first pipeline
        try:
            cached_consensus = json.loads(consensus_data)
            print(f"DEBUG: Parsed consensus data keys: {list(cached_consensus.keys())}")
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid consensus_data JSON")
        
        # Extract required data from cached consensus
        asr_results = cached_consensus.get("asr_results", {})
        consensus_transcription = cached_consensus.get("primary", "")
        asr_generated_phonemes = cached_consensus.get("asr_generated_phonemes", [])
        
        # Extract Allosaurus result for phoneme analysis
        allosaurus_result = asr_results.get("results", {}).get("allosaurus", {})
        allosaurus_timing = allosaurus_result.get("diagnostics", {}).get("timed_phonemes", []) if allosaurus_result.get("status") == "success" else []
        
        # Parse human particle selections if provided
        parsed_human_particles = None
        if human_particles:
            try:
                parsed_human_particles = json.loads(human_particles)
            except json.JSONDecodeError:
                parsed_human_particles = None
        
        # Run the full pipeline: Step 4A (detection), 4B (placement), 5 (final integration)
        context_with_accent = f"{context} - Focus on {accent_hint} accent particles" if accent_hint else context
        print(f"DEBUG: Using context: {context_with_accent}")
        
        try:
            async with aiohttp.ClientSession() as session:
                # Check if human particles were provided - use them directly if available
                if parsed_human_particles:
                    print("DEBUG: Using human-provided particle selections")
                    return {
                        **cached_consensus,
                        "primary": consensus_transcription,
                        "ai_generated_transcription": consensus_transcription,  # Use consensus as fallback
                        "potential_particles": parsed_human_particles.get('particles', []),
                        "stage": "particles_with_accent_human_selected",
                        "accent_hint": accent_hint,
                        "accent_specific_particles": DISCOURSE_PARTICLES.get(accent_hint, []) if accent_hint else [],
                        "confidence": 1.0,
                        "particle_analysis": {
                            "potential_particles": parsed_human_particles.get('particles', []),
                            "particle_positions": parsed_human_particles.get('positions', {}),
                            "reasoning": "Human-selected particles"
                        }
                    }
                
                # --- Step 4A: Particle Detection ---
                consensus_result = {
                    "consensus_transcription": consensus_transcription,
                    "transcription_variants": [],
                    "primary_model": "cached",
                    "model_agreement_score": 1.0
                }
                
                accent_particles = {accent_hint: DISCOURSE_PARTICLES[accent_hint]} if accent_hint and accent_hint in DISCOURSE_PARTICLES else DISCOURSE_PARTICLES
                particle_analysis = orchestrator.prepare_particle_analysis_data(
                    consensus_result.get("consensus_transcription", ""),
                    asr_generated_phonemes,
                    allosaurus_timing
                )
                
                timing_summary = [f"{i}: {p['phoneme']} at {p['start_time']:.2f}s" for i, p in enumerate(allosaurus_timing)]
                
                ipa_prompt = get_particle_detection_prompt(
                    accent_particles,
                    particle_analysis['allosaurus_phonemes'],
                    timing_summary,
                    particle_analysis['timing_data'],
                    consensus_result.get("consensus_transcription", "")
                )
                
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
                            },
                            "llm_recommended_transcription": {"type": "string"}
                        },
                        "required": ["particles_found", "llm_recommended_transcription"]
                    }
                }]
                
                step4a_result = await orchestrator.call_gemini_api(ipa_prompt, session, ipa_interpretation_functions)
                
                if step4a_result.get("status") == "success" and "function_call" in step4a_result:
                    ipa_interpretation = step4a_result["function_call"]["args"]
                else:
                    ipa_interpretation = {"particles_found": [], "llm_recommended_transcription": ""}
                
                # --- Step 4B: Particle Placement ---
                placement_analysis_functions = [{
                    "name": "analyze_particle_placement",
                    "description": "Analyze where particles should be placed by comparing IPA interpretation with consensus transcription",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "detected_particles": {"type": "array", "items": {"type": "string"}},
                            "particle_positions": {"type": "object"},
                            "placement_reasoning": {"type": "string"}
                        },
                        "required": ["detected_particles", "particle_positions", "placement_reasoning"]
                    }
                }]
                
                validated_data = cached_consensus.get("validation_data", {})
                consensus_data_inner = cached_consensus.get("consensus_data", {})
                search_data = cached_consensus.get("search_data", {})
                
                if 'final_consensus' not in validated_data:
                    validated_data['final_consensus'] = consensus_data_inner.get('consensus_transcription', consensus_result.get("consensus_transcription", ""))
                
                placement_prompt = get_particle_placement_prompt(
                    validated_data,
                    particle_analysis,
                    ipa_interpretation,
                    accent_particles,
                    allosaurus_timing
                )
                
                step4b_result = await orchestrator.call_gemini_api(placement_prompt, session, placement_analysis_functions)
                
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
                    particle_data = {
                        "base_transcription": validated_data['final_consensus'],
                        "expected_phonemes": particle_analysis['expected_phonemes'],
                        "outlier_phonemes": particle_analysis['outlier_phonemes'],
                        "detected_particles": [],
                        "particle_positions": {},
                        "ipa_interpretation": ipa_interpretation
                    }
                
                # --- Step 5: Final Transcription Assembly ---
                final_functions = [{
                    "name": "generate_final_transcription",
                    "description": "Create the best possible transcription using all pipeline analysis, incorporating detected particles where appropriate.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "final_transcription": {"type": "string"},
                            "integrated_transcription_all_particles": {"type": "string"},
                            "confidence_score": {"type": "number"}
                        },
                        "required": ["final_transcription", "integrated_transcription_all_particles", "confidence_score"]
                    }
                }]
                
                final_prompt = get_final_transcription_prompt(
                    consensus_data_inner,
                    search_data,
                    validated_data,
                    particle_data
                )
                
                step5_result = await orchestrator.call_gemini_api(final_prompt, session, final_functions)
                
                if step5_result.get("status") == "success" and "function_call" in step5_result:
                    final_data = step5_result["function_call"]["args"]
                else:
                    final_data = {
                        "final_transcription": validated_data['final_consensus'],
                        "integrated_transcription_all_particles": validated_data['final_consensus'],
                        "confidence_score": consensus_data_inner.get('model_agreement_score', 1.0)
                    }
                
                # Extract primary transcription (best result from Gemini pipeline)
                primary_transcription = final_data.get('integrated_transcription_all_particles', final_data.get('final_transcription', validated_data['final_consensus']))
                
                # --- Response ---
                return {
                    **cached_consensus,  # Include all original consensus data
                    "primary": consensus_result.get("consensus_transcription", ""),  # Base consensus
                    "ai_generated_transcription": primary_transcription,  # LLM-integrated result
                    "potential_particles": ipa_interpretation.get('particles_found', []),
                    "stage": "particles_with_accent_finalized",
                    "accent_hint": accent_hint,
                    "accent_specific_particles": DISCOURSE_PARTICLES.get(accent_hint, []) if accent_hint else [],
                    "confidence": final_data.get('confidence_score', 1.0)
                }
                
        except Exception as e:
            print(f"ERROR: Exception in /transcribe-with-particles: {str(e)}")
            print(f"ERROR: Exception type: {type(e).__name__}")
            import traceback
            print(f"ERROR: Traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=str(e))
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)