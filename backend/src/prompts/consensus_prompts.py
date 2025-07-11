"""
Consensus analysis prompts for Step 1 of the pipeline
"""

def get_consensus_prompt(asr_results_json, context):
    """Generate consensus establishment prompt"""
    return f"""Analyze these ASR transcription results and establish a basic consensus.

**Context**: {context}

**ASR Results**:
{asr_results_json}

**Analysis Instructions**:
Compare the transcriptions from all successful models and determine:
1. The most likely correct transcription based on common words/phrases
2. Which model performed best
3. Overall confidence in the consensus
4. Alternative transcriptions that might be valid

**Detailed Guidance**:
- Look for words that appear consistently across multiple models
- Weight models based on their typical accuracy and reliability
- Consider the context when resolving discrepancies between models
- Prefer transcriptions that are more coherent and contextually appropriate
- Account for common ASR model strengths and weaknesses
- Don't truncate or shorten the transcription - capture the full utterance
- If multiple models agree on longer phrases, prefer the longer consensus

Call the establish_basic_consensus function with your analysis."""