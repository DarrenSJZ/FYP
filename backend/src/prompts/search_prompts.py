def get_search_analysis_prompt(consensus_transcription, context, asr_alternatives=None):
    """Generate spelling context analysis prompt for proper nouns only."""
    alternatives_text = ""
    if asr_alternatives:
        alternatives_text = f"\n\n**ASR Model Alternatives**:\n"
        for model, result in asr_alternatives.items():
            if model != "allosaurus" and result.get("transcription"):
                alternatives_text += f"- {model}: \"{result['transcription']}\"\n"
    
    return f"""Analyze the consensus transcription to identify PROPER NOUNS ONLY that may need spelling context verification.

**Context**: {context}

**Consensus Transcription**: "{consensus_transcription}"{alternatives_text}

**Task - PROPER NOUNS ONLY**:
- Identify proper nouns (names of people, places, organizations, brands, etc.)
- Check if these proper nouns appear to be misspelled or unclear
- Suggest search queries to verify correct spelling of proper nouns
- Focus ONLY on proper nouns - ignore common words, pronouns, verbs, etc.

**Examples of what to search**:
- Person names: "John Smith", "Sarah Johnson"
- Place names: "Los Angeles", "Mount Everest"  
- Company names: "Microsoft", "Tesla"
- Brand names: "iPhone", "Mercedes-Benz"

**What NOT to search**:
- Common words: "the", "and", "very", "quickly"
- Pronouns: "he", "she", "it", "they"
- Verbs: "running", "eating", "said"
- Adjectives: "beautiful", "fast", "red"

**Guidance**:
- ONLY analyze proper nouns for spelling verification
- If no proper nouns exist or all are clearly spelled correctly, return empty result
- Use context to determine if a proper noun needs verification
- This is for spelling context only - NOT to modify the transcription

Call the `identify_search_worthy_terms` function with your analysis."""