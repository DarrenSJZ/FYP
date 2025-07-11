"""
Validation prompts for Step 3 of the pipeline
"""

def get_validation_prompt(consensus_data, search_data, web_context):
    """Generate web validation prompt"""
    return f"""Validate and correct the transcription using web search results.

**Original Consensus**: "{consensus_data['consensus_transcription']}"
**Primary Model**: {consensus_data['primary_model']}
**Agreement Score**: {consensus_data['model_agreement_score']}

**Search Analysis**:
Search Terms: {search_data['search_queries']}
Search Reasoning: {search_data['search_reasoning']}

{web_context}

**Task**:
- Based on the web search results, determine which terms should be corrected
- Identify which proper nouns are confirmed by the search results
- Provide the final validated transcription with corrections applied
- IMPORTANT: Preserve the full original transcription length and meaning
- Explain your reasoning for any changes made

**Guidance**:
- Use web search results to validate uncertain terms
- Correct obvious errors based on search evidence
- Preserve original transcription where search results don't provide clear corrections
- Focus on improving accuracy while maintaining the original meaning

Call the validate_with_web_context function with your analysis."""