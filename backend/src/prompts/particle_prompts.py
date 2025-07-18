"""
Particle detection prompts for Step 4 of the pipeline
"""
import json

def get_particle_detection_prompt(discourse_particles, allosaurus_phonemes, timing_summary, timing_data, consensus_transcript):
    """Generate IPA particle detection prompt"""
    words = consensus_transcript.split()
    
    # Extract region name and particles for cleaner prompt
    region_name = list(discourse_particles.keys())[0] if discourse_particles else "unknown"
    particle_list = list(discourse_particles.values())[0] if discourse_particles else []
    
    # Defensive: ensure timing_data is a list of dicts
    if not isinstance(timing_data, list):
        timing_data = []
    elif any(not isinstance(item, dict) for item in timing_data):
        timing_data = [item for item in timing_data if isinstance(item, dict)]

    return f"""Analyze IPA phonemes to identify *potential* discourse particles. Your goal is to suggest plausible particle occurrences for human review, even if phonetic matches are not perfect.

**Target Particles**: {particle_list}
**Accent/Region**: {region_name}

**Consensus Transcript**: "{consensus_transcript}"
**Word Count**: {len(words)} words
**Words**: {words}

**IPA Phonemes**:
{' '.join(allosaurus_phonemes)}

**Timing Reference (Summary)**:
{timing_summary}

**Timing Data (Detailed)**:
{json.dumps(timing_data, indent=2)}

**Task**:
- ONLY suggest particles from the target particles list above: {particle_list}
- Scan the IPA sequence for consecutive phoneme sequences that *plausibly* represent these particles.
- **Be lenient with phonetic variations**: For example, 'la' might appear as 'lɑ', 'lə', or even a reduced form. Focus on sequences that are phonetically *similar enough* to the target particle.
- For each *potential* particle, provide:
  - <particle>: the EXACT particle from target list (e.g., 'la', 'lor')
  - <ipa>: the source IPA phoneme sequence that you believe represents the particle
  - <confidence>: confidence score (0.0-1.0) based on phonetic similarity (higher for closer matches, lower for more varied but plausible matches)
  - <word_index>: word position to insert after (0-based index, max {len(words)}). 0 means before the first word.
  - <character_position>: exact character index in transcript string where the particle should be inserted.
  - <region>: "{region_name}"

**IMPORTANT CONSIDERATIONS FOR SUGGESTIONS**:
- **Human Validation**: Your suggestions will be reviewed by a human. It is better to suggest a plausible particle that might be incorrect than to miss a real one.
- **Distinguishing from main content**: While phonetic overlap can occur, discourse particles are typically short, unstressed, and do not carry significant semantic meaning within the sentence. Prioritize sequences that *function* as particles rather than being integral parts of words.
- DO NOT invent new particles or suggest words not in the target list.
- If no strong matches are found, still suggest 1–3 of the most plausible candidates from the target list, even if confidence is low or the match is uncertain.
- Your output will be reviewed by a human, so it is better to suggest possible candidates than to return an empty list.
- Calculate word_index as 0-based position (0=before first word, 1=after first word, etc.)
- Calculate character_position as exact character index in transcript string.
- Example: For transcript "Don't be like that" - inserting after "like" would be word_index=2, character_position=14

Call the find_discourse_particles function with your analysis."""

def get_particle_placement_prompt(validated_data, particle_analysis, ipa_interpretation, discourse_particles, allosaurus_timing):
    print("DEBUG: validated_data in get_particle_placement_prompt:", validated_data)
    """Generate particle placement analysis prompt"""
    return f"""Analyze where discourse particles should be placed in the final transcription.

**Context Data**:
- Consensus Transcription: "{validated_data['final_consensus']}"
- Expected Phonemes: {particle_analysis['expected_phonemes']}
- Raw Allosaurus IPA: {particle_analysis['allosaurus_phonemes']}
- IPA Interpretation from Step 4A: {ipa_interpretation}

**Discourse Particle Reference**:
{discourse_particles}

**Timing Data**:
{json.dumps(allosaurus_timing, indent=2)}

**Task**:
1. Compare the Allosaurus IPA interpretation with the consensus transcription.
2. Identify <potential_particle> sounds present in Allosaurus but absent in the consensus transcription.
3. Validate each <potential_particle> against the <discourse_particle_reference> list.
4. Only classify a sound as a particle if it matches or is highly similar to an entry in the reference list.
5. Determine the precise placement of valid particles based on timing data and linguistic context.
6. Use phonemizer expected phonemes as a reference for word boundaries.

**Guidance**:
- If Allosaurus detects a <potential_particle> not present in the consensus transcription, and it matches an entry in <discourse_particle_reference>, place it in the transcription based on timing and context.

Call the analyze_particle_placement function with your analysis."""