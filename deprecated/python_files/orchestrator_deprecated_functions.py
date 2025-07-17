
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