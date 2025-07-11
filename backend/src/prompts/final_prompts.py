"""
Final transcription assembly prompts for Step 5 of the pipeline
"""
import json

def get_final_transcription_prompt(consensus_data, search_data, validated_data, particle_data):
    print("DEBUG: validated_data in get_final_transcription_prompt:", validated_data)
    """Generate final transcription assembly prompt"""
    return f"""Create the final transcription using all pipeline analysis.

**Pipeline Analysis Results**:

**Consensus Analysis**:
- Primary transcription: "{consensus_data['consensus_transcription']}"
- Model agreement: {consensus_data['model_agreement_score']}
- Best model: {consensus_data['primary_model']}

**Search & Validation**:
- Search terms: {search_data.get('search_queries', [])}
- Validated transcription: "{validated_data['final_consensus']}"

**Particle Detection**:
- Detected particles: {particle_data.get('detected_particles', [])}
- Base transcription: "{particle_data['base_transcription']}"
- IPA interpretation: {particle_data.get('ipa_interpretation', {})}


**Task**:
- Synthesize all analysis into the highest quality final transcription
- Integrate detected particles where linguistically appropriate
- Ensure transcription accuracy while preserving natural speech patterns
- Provide confidence assessment and rationale for decisions

**Guidance**:
- Prioritize validated transcription as the base
- Add particles only where they improve transcription quality
- Maintain natural speech flow and readability
- Consider context and speaker intent

Call the generate_final_transcription function with your analysis."""