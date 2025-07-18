"""
Validation prompts for Step 3 of the pipeline
"""

def get_validation_prompt(consensus_data, search_data, web_context):
    """Generate spelling context validation prompt - FOR CONTEXT ONLY, NOT TO MODIFY TRANSCRIPTION"""
    return f"""Analyze web search results to provide spelling context for proper nouns. DO NOT modify the transcription.

**Original Consensus**: "{consensus_data['consensus_transcription']}"
**Primary Model**: {consensus_data['primary_model']}
**Agreement Score**: {consensus_data['model_agreement_score']}

**Search Analysis**:
Search Terms: {search_data['search_queries']}
Search Reasoning: {search_data['search_reasoning']}

{web_context}

**Task - CONTEXT ONLY**:
- Identify which proper nouns are confirmed by web search results
- Provide spelling context and verification for proper nouns
- Note any discrepancies between transcription and web results
- IMPORTANT: Return the original consensus transcription unchanged
- Provide context information only - do NOT modify the transcription

**Guidance**:
- This is for spelling context verification only
- Always return the original consensus transcription as final_consensus
- Use web results to understand correct spellings but don't change anything
- Focus on providing context rather than corrections

Call the validate_with_web_context function with your analysis."""