"""
Search analysis prompts for Step 2 of the pipeline
"""

def get_search_analysis_prompt(consensus_transcription, context):
    """Generate search analysis prompt"""
    return f"""Analyze the consensus transcription and identify terms that need web validation.

**Context**: {context}

**Consensus Transcription**: "{consensus_transcription}"

**Task**:
- Identify terms that might be uncertain, ambiguous, or require validation
- Focus on proper nouns, technical terms, brand names, or unusual words
- Suggest specific search queries to validate these terms
- Provide reasoning for why each term needs validation

**Guidance**:
- Prioritize terms that could significantly impact transcription accuracy
- Consider context when determining uncertainty
- Suggest precise search queries that would help validate or correct terms
- Avoid over-searching common, clearly correct words

Call the analyze_search_terms function with your analysis."""