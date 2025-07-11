"""
Particle detection prompts for Step 4 of the pipeline
"""
import json

def get_particle_detection_prompt(discourse_particles, allosaurus_phonemes, timing_summary, timing_data, consensus_transcript):
    """Generate IPA particle detection prompt"""
    words = consensus_transcript.split()
    return f"""Analyze IPA phonemes to identify potential discourse particles with confidence scores.

**Reference Particles by Region**:
{json.dumps(discourse_particles, indent=2)}

**Consensus Transcript**: "{consensus_transcript}"
**Word Count**: {len(words)} words
**Words**: {words}

**IPA Phonemes**:
{allosaurus_phonemes}

**Timing Reference**:
{timing_summary}

**Task**:
- Scan the IPA sequence for consecutive phoneme sequences that could match particles from the reference lists
- Be liberal in detecting potential particles - even partial matches should be considered
- For each potential particle, provide:
  - <particle>: the matched particle from reference (or closest match)
  - <ipa>: the source IPA phoneme sequence  
  - <confidence>: confidence score (0.0-1.0) based on phonetic match quality
  - <word_index>: word position to insert after (0-based index, max {len(words)})
  - <character_position>: exact character position in transcript string
  - <region>: which regional set it belongs to (southeast_asian, british, indian, universal)

**Guidance**:
- BE GENEROUS with potential matches - look for sounds that could be particles
- Consider phonetic variations and pronunciation differences
- Even words already in the transcript might have particle-like usage (e.g., "man" as discourse marker)
- Assign confidence based on phonetic similarity (0.3+ for loose matches, 0.7+ for clear matches)
- Calculate word_index as 0-based position (0=before first word, 1=after first word, etc.)
- Calculate character_position as exact character index in transcript string
- Example: For transcript "Don't be like that" - inserting after "like" would be word_index=2, character_position=14
- Return at least 1-2 potential particles with varying confidence scores when phonemes are present

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