"""
Consensus analysis prompts for Step 1 of the pipeline
"""

def get_consensus_prompt(asr_results_json, context, ground_truth=None):
    """Generate consensus establishment prompt"""
    if ground_truth:
        return get_practice_consensus_prompt(asr_results_json, context, ground_truth)
    
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

def get_practice_consensus_prompt(asr_results_json, context, ground_truth):
    """Generate practice mode consensus prompt with ground truth comparison"""
    return f"""Analyze these ASR transcription results against a known validated transcription for educational purposes.

**Context**: {context} (Practice Mode)
**Ground Truth**: "{ground_truth}"

**ASR Results**:
{asr_results_json}

**Practice Mode Analysis Instructions**:
Compare each ASR model's output against the validated ground truth transcription:
1. Identify which models were most accurate compared to ground truth
2. Highlight common error patterns across models
3. Analyze types of mistakes (substitutions, deletions, insertions)
4. Provide educational insights about ASR model strengths/weaknesses
5. Determine consensus transcription while noting accuracy vs ground truth

**Educational Focus**:
- Which words were consistently missed by ASR models?
- What types of sounds or words cause the most errors?
- How close did the consensus get to the validated transcription?
- What can users learn about ASR limitations from this example?

**Output Requirements**:
- Still provide a consensus transcription (best ASR result)
- Include accuracy comparison with ground truth
- Highlight learning opportunities for users
- Note: Users will see both ASR consensus AND ground truth for comparison

Call the establish_basic_consensus function with your analysis."""