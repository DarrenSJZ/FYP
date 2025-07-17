def get_search_analysis_prompt(consensus_transcription, context, asr_alternatives=None):
    """Generate search analysis prompt for Step 2, focusing on ambiguous pronouns, misspelled words, and term connections."""
    alternatives_text = ""
    if asr_alternatives:
        alternatives_text = f"\n\n**ASR Model Alternatives**:\n"
        for model, result in asr_alternatives.items():
            if model != "allosaurus" and result.get("transcription"):
                alternatives_text += f"- {model}: \"{result['transcription']}\"\n"
    
    return f"""Analyze the consensus transcription to identify ambiguous pronouns, potentially misspelled words, and connections between terms that need web validation.

**Context**: {context}

**Consensus Transcription**: "{consensus_transcription}"{alternatives_text}

**Task**:
- Identify pronouns (e.g., personal, possessive, reflexive) that are ambiguous or misheard, potentially referring to multiple individuals.
- Identify words, especially names or context-specific terms, that appear misspelled or inconsistent with the context, likely due to transcription errors.
- Detect connections between terms (e.g., a name and a related concept like 'Formula 1') that appear together to clarify context and ensure accurate identification.
- Suggest precise search queries combining connected terms to validate spellings and associations (e.g., 'Max Verstappen Formula 1' to confirm a name).
- If the transcription has no ambiguous pronouns, misspelled words, or significant term connections requiring validation, return an empty result with reasoning explaining the clarity.

**Guidance**:
- Compare consensus transcription with ASR alternatives to identify discrepancies
- If multiple models agree on a word but consensus differs, DO NOT search - trust the models
- Prioritize terms or connections that could significantly impact transcription accuracy
- Use the context to assess pronoun ambiguity or word correctness
- Combine connected terms in search queries to leverage online data for accurate spellings and associations
- Avoid searching common, clearly correct words or unambiguous terms
- Treat examples (e.g., 'he' for pronouns, 'Formula 1' for connections) as illustrative only; do not let them skew your analysis. Provide reasoning for why each term or connection needs validation, focusing on potential errors or ambiguity

Call the `identify_search_worthy_terms` function with your analysis."""