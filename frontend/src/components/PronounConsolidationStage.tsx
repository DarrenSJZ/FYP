import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Volume2, Brain, Search, CheckCircle2, ArrowRight, Info } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { StageNavigation } from "./StageNavigation";
import { StageProgressBar } from "./StageProgressBar";
import type { WorkflowStage } from "@/pages/Index";

interface PronounConsolidationChoice {
  transcription: string;
  label: string;
  description: string;
  confidence: number;
  reasoning: string;
}

interface PronounConsolidationStageProps {
  audioFile?: File;
  audioUrl?: string;
  pronounConsolitdationChoices?: {
    option_a: string | PronounConsolidationChoice;
    option_b: string | PronounConsolidationChoice;
    educational_note?: string;
  };
  onChoiceSelected: (selectedOption: 'option_a' | 'option_b', selectedTranscription: string) => void;
  onBack: () => void;
  completedStages: Set<WorkflowStage>;
  onStageClick?: (stage: WorkflowStage) => void;
  isAudioPlaying: boolean;
  onAudioPlayPause: () => void;
}

export function PronounConsolidationStage({
  audioFile,
  audioUrl,
  pronounConsolitdationChoices,
  onChoiceSelected,
  onBack,
  completedStages,
  onStageClick,
  isAudioPlaying,
  onAudioPlayPause,
}: PronounConsolidationStageProps) {
  const [selectedOption, setSelectedOption] = useState<'option_a' | 'option_b' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Debug logging
  useEffect(() => {
    console.log('DEBUG: PronounConsolidationStage - pronounConsolitdationChoices:', pronounConsolitdationChoices);
    console.log('DEBUG: Full JSON structure:', JSON.stringify(pronounConsolitdationChoices, null, 2));
  }, [pronounConsolitdationChoices]);

  // Helper function to normalize option to full object
  const normalizeOption = (option: string | PronounConsolidationChoice | undefined, defaultLabel: string): PronounConsolidationChoice => {
    if (typeof option === 'string') {
      // Handle specific error cases
      if (option === "ASR transcription unavailable" || option === "Consensus transcription unavailable") {
        return {
          transcription: "Transcription processing failed - please try refreshing",
          label: `${defaultLabel} (Error)`,
          description: "There was an issue processing the transcription",
          confidence: 0.0,
          reasoning: "Processing error - refresh recommended"
        };
      }
      
      return {
        transcription: option,
        label: defaultLabel,
        description: `${defaultLabel} transcription`,
        confidence: 0.8,
        reasoning: "AI consensus result"
      };
    } else if (option && typeof option === 'object') {
      // Also check if the object contains error transcriptions
      const transcription = option.transcription;
      if (transcription === "ASR transcription unavailable" || transcription === "Consensus transcription unavailable") {
        return {
          ...option,
          transcription: "Transcription processing failed - please try refreshing",
          label: `${option.label} (Error)`,
          description: "There was an issue processing the transcription",
          confidence: 0.0,
          reasoning: "Processing error - refresh recommended"
        };
      }
      return option;
    } else {
      return {
        transcription: "No transcription available",
        label: defaultLabel,
        description: "No data available",
        confidence: 0.0,
        reasoning: "No data"
      };
    }
  };

  const effectiveChoices = pronounConsolitdationChoices ? {
    option_a: normalizeOption(pronounConsolitdationChoices.option_a, "AI Consensus"),
    option_b: normalizeOption(pronounConsolitdationChoices.option_b, "Web Validated")
  } : {
    // Fallback choices when backend data is missing
    option_a: {
      transcription: "No transcription available",
      label: "AI Consensus",
      description: "AI consensus (data unavailable)",
      confidence: 0.0,
      reasoning: "Fallback option"
    },
    option_b: {
      transcription: "No transcription available",
      label: "Web Validated",
      description: "Web validation (data unavailable)",
      confidence: 0.0,
      reasoning: "Fallback option"
    }
  };

  const areTranscriptionsDifferent = effectiveChoices ? effectiveChoices.option_a.transcription !== effectiveChoices.option_b.transcription : false;

  // Extract search terms from reasoning text
  const extractSearchTerms = (reasoning: string): string[] => {
    const searchTermsMatch = reasoning.match(/Verified Search Terms: ([^•]+)/);
    if (searchTermsMatch) {
      return searchTermsMatch[1].split(',').map(term => term.trim()).filter(term => term.length > 0);
    }
    return [];
  };

  // Clean reasoning text by removing search terms line to avoid duplication
  const cleanReasoning = (reasoning: string): string => {
    return reasoning
      .replace(/Verified Search Terms: [^•\n]+/g, '') // Remove search terms line
      .replace(/Confirmed: [^•\n]+/g, '') // Remove confirmed terms line  
      .replace(/Corrected: [^•\n]+/g, '') // Remove corrected terms line
      .replace(/Primary model: [^•\n]+/gi, '') // Remove primary model line
      .replace(/\d+\/\d+ models? agreed?[^•\n]*/gi, '') // Remove model agreement line
      .replace(/\n\s*\n/g, '\n') // Remove extra empty lines
      .trim();
  };

  // Extract confirmed terms from reasoning text
  const extractConfirmedTerms = (reasoning: string): string[] => {
    const confirmedMatch = reasoning.match(/Confirmed: ([^•]+)/);
    if (confirmedMatch) {
      return confirmedMatch[1].split(',').map(term => term.trim()).filter(term => term.length > 0);
    }
    return [];
  };

  // Extract corrected terms from reasoning text
  const extractCorrectedTerms = (reasoning: string): string[] => {
    const correctedMatch = reasoning.match(/Corrected: ([^•]+)/);
    if (correctedMatch) {
      return correctedMatch[1].split(',').map(term => term.trim()).filter(term => term.length > 0);
    }
    return [];
  };

  // Extract primary model info from reasoning text
  const extractPrimaryModel = (reasoning: string): string | null => {
    const primaryMatch = reasoning.match(/Primary model: (\w+)/i);
    return primaryMatch ? primaryMatch[1] : null;
  };

  // Extract model agreement info from reasoning text
  const extractModelAgreement = (reasoning: string): string | null => {
    const agreementMatch = reasoning.match(/(\d+)\/(\d+) models? agreed?/i);
    return agreementMatch ? `${agreementMatch[1]}/${agreementMatch[2]} models` : null;
  };

  useEffect(() => {
    if (!areTranscriptionsDifferent) {
      toast({
        title: "💡 Options are Identical",
        description: "Both options are identical because the web validation confirmed the AI consensus was already correct.",
        variant: "default",
      });
      // Auto-select the option since there's only one choice
      setSelectedOption('option_a');
    }
  }, [areTranscriptionsDifferent, toast]);

  const handleOptionSelect = (option: 'option_a' | 'option_b') => {
    setSelectedOption(option);
  };

  const handleConfirm = async () => {
    if (!selectedOption || !effectiveChoices) return;

    setIsSubmitting(true);
    const selectedTranscription = effectiveChoices[selectedOption].transcription;
    onChoiceSelected(selectedOption, selectedTranscription);
    setIsSubmitting(false);
  };

  const formatConfidence = (confidence: number) => {
    return Math.round(confidence * 100);
  };

  const getIcon = (option: 'option_a' | 'option_b') => {
    if (option === 'option_a') {
      return <Brain className="w-5 h-5 text-primary" />;
    } else {
      return <Search className="w-5 h-5 text-accent" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-[hsl(var(--sage-green))] text-white';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
    return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
  };

  const getSelectionColor = (option: 'option_a' | 'option_b') => {
    if (option === 'option_a') {
      return selectedOption === 'option_a'
        ? 'border-primary bg-primary/10'
        : 'border-border hover:border-primary/50';
    } else {
      return selectedOption === 'option_b'
        ? 'border-accent bg-accent/10'
        : 'border-border hover:border-accent/50';
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 flex flex-col items-center justify-center pt-12 pb-12">
      {/* Progress Bar */}
      <StageProgressBar
        currentStage="pronoun-consolidation"
        completedStages={completedStages}
        onStageClick={onStageClick}
      />

      {/* Stage Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Pronoun Consolidation</h2>
        <p className="text-muted-foreground">
          Consolidate pronouns between AI consensus and web-validated transcription
        </p>
      </div>

      {/* Navigation */}
      <div className="w-full">
        <StageNavigation
          onBack={onBack}
          onNext={handleConfirm}
          nextText="Next"
          nextDisabled={!selectedOption || isSubmitting}
        />
      </div>

      {/* Audio Player */}
      {(audioFile || audioUrl) && (
        <div className="flex justify-center">
          <Button
            onClick={onAudioPlayPause}
            className={`
              px-6 py-4 rounded-2xl transition-all duration-200 
              ${isAudioPlaying 
                ? 'bg-accent hover:bg-accent/90 text-accent-foreground' 
                : 'bg-primary hover:bg-primary/90 text-primary-foreground hover:scale-105'
              }
              shadow-lg hover:shadow-xl border-b-4 
              ${isAudioPlaying ? 'border-accent/70' : 'border-primary/70'}
              active:border-b-2 active:translate-y-0.5
            `}
          >
            <div className="flex items-center gap-3">
              <div className={`transition-transform duration-200 ${isAudioPlaying ? 'animate-pulse' : ''}`}>
                <Volume2 className={`h-6 w-6 ${isAudioPlaying ? 'animate-bounce' : ''}`} />
              </div>
              <div className="flex gap-1">
                <div className={`w-1 ${isAudioPlaying ? 'bg-accent-foreground' : 'bg-primary-foreground'} rounded-full ${isAudioPlaying ? 'h-4 animate-pulse' : 'h-2'} transition-all duration-300`}></div>
                <div className={`w-1 ${isAudioPlaying ? 'bg-accent-foreground' : 'bg-primary-foreground'} rounded-full ${isAudioPlaying ? 'h-6 animate-pulse' : 'h-2'} transition-all duration-300 delay-75`}></div>
                <div className={`w-1 ${isAudioPlaying ? 'bg-accent-foreground' : 'bg-primary-foreground'} rounded-full ${isAudioPlaying ? 'h-3 animate-pulse' : 'h-2'} transition-all duration-300 delay-150`}></div>
                <div className={`w-1 ${isAudioPlaying ? 'bg-accent-foreground' : 'bg-primary-foreground'} rounded-full ${isAudioPlaying ? 'h-5 animate-pulse' : 'h-2'} transition-all duration-300 delay-225`}></div>
              </div>
            </div>
          </Button>
        </div>
      )}

      {/* Error State Check */}
      {(() => {
        const hasError = effectiveChoices && (
          effectiveChoices.option_a.label.includes('(Error)') || 
          effectiveChoices.option_b.label.includes('(Error)') ||
          effectiveChoices.option_a.transcription.includes('processing failed') ||
          effectiveChoices.option_b.transcription.includes('processing failed')
        );

        if (hasError) {
          return (
            <div className="w-full max-w-2xl mx-auto">
              <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-xl text-center">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Info className="h-6 w-6 text-destructive" />
                  <h3 className="text-lg font-semibold text-destructive">Transcription Processing Error</h3>
                </div>
                <p className="text-destructive mb-4">
                  There was an issue processing the transcription data from the previous stage.
                </p>
                <div className="space-y-2 text-sm text-muted-foreground mb-4">
                  <p>This could be due to:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Backend connection issues</li>
                    <li>Audio processing failures</li>
                    <li>Missing consensus data</li>
                  </ul>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button 
                    onClick={() => window.location.reload()} 
                    variant="destructive"
                    className="gap-2"
                  >
                    <Info className="h-4 w-4" />
                    Refresh Page
                  </Button>
                  <Button 
                    onClick={onBack} 
                    variant="outline"
                  >
                    Go Back
                  </Button>
                </div>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* A/B Choice Instructions - Only show if no error */}
      {!effectiveChoices || (!effectiveChoices.option_a.label.includes('(Error)') && !effectiveChoices.option_b.label.includes('(Error)')) ? (
        <div className="w-full">
          {!areTranscriptionsDifferent ? (
            // Centered instructions for combined/identical transcriptions
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-3 mb-2">
                <Info className="h-6 w-6 text-primary" />
                <h3 className="text-xl font-semibold">Confirmed Transcription</h3>
              </div>
              <p className="text-base text-muted-foreground max-w-2xl mx-auto">Web validation confirmed the AI consensus was correct - click to proceed with the verified transcription</p>
            </div>
          ) : (
            // Left-aligned instructions for different A/B transcriptions
            <div className="text-left mb-6">
              <div className="flex items-center gap-3 mb-2">
                <Info className="h-6 w-6 text-primary" />
                <h3 className="text-xl font-semibold">A/B Choice Selection</h3>
              </div>
              <p className="text-base text-muted-foreground ml-9">Compare the AI consensus vs web-validated transcription cards, then select an option that best matches the audio</p>
            </div>
          )}
        </div>
      ) : null}

      {/* Transcription Options - Left/Right Layout or Combined - Only show if no error */}
      {!effectiveChoices || (!effectiveChoices.option_a.label.includes('(Error)') && !effectiveChoices.option_b.label.includes('(Error)')) ? (
        <div className="w-full max-w-6xl">
        {!areTranscriptionsDifferent ? (
          // Combined card when transcriptions are identical
          <div className="flex flex-col items-center space-y-4">
            <div 
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg p-6 rounded-xl border-2 max-w-4xl w-full ${
                selectedOption ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
              }`}
              onClick={() => handleOptionSelect('option_a')} // Either option works since they're the same
            >
              <div className="space-y-4">
                {/* Header inside card */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Brain className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">Confirmed Transcription</h3>
                  </div>
                  {selectedOption && (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  )}
                </div>
                
                {/* Confidence and Description */}
                <div className="flex items-center justify-between">
                  <Badge className={getConfidenceColor(effectiveChoices?.option_b.confidence || 0)}>
                    {formatConfidence(effectiveChoices?.option_b.confidence || 0)}% confident
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">AI consensus confirmed by web validation</p>
                
                <div className="font-mono text-sm bg-card border border-border rounded-lg p-4">
                  "{effectiveChoices?.option_a.transcription}"
                </div>
                
                {/* Show search terms if any were verified */}
                {(() => {
                  const searchTerms = extractSearchTerms(effectiveChoices?.option_b.reasoning || '');
                  const confirmedTerms = extractConfirmedTerms(effectiveChoices?.option_b.reasoning || '');
                  const correctedTerms = extractCorrectedTerms(effectiveChoices?.option_b.reasoning || '');
                  
                  if (searchTerms.length > 0 || confirmedTerms.length > 0 || correctedTerms.length > 0) {
                    return (
                      <div className="space-y-2">
                        {searchTerms.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground font-medium">Verified:</span>
                            {searchTerms.map((term, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {term}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {confirmedTerms.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground font-medium">Confirmed:</span>
                            {confirmedTerms.map((term, index) => (
                              <Badge key={index} variant="secondary" className="text-xs bg-[hsl(var(--sage-green))]/20">
                                {term}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {correctedTerms.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground font-medium">Corrected:</span>
                            {correctedTerms.map((term, index) => (
                              <Badge key={index} variant="secondary" className="text-xs bg-[hsl(var(--chip-brown))]/20 text-[hsl(var(--chip-brown))] hover:bg-[hsl(var(--chip-brown))]/30">
                                {term}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="w-3 h-3" />
                  <span>Web validation confirmed the AI consensus was correct</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Original two-card layout when transcriptions are different
          <div className="flex flex-col md:flex-row gap-8 items-stretch">
            {/* Option A - AI Consensus (Left) */}
            <div className="flex-1">
            {/* Card bubble */}
            <div 
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg p-6 rounded-xl border-2 ${getSelectionColor('option_a')}`}
              onClick={() => handleOptionSelect('option_a')}
            >
              <div className="space-y-3">
                {/* Header inside card */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getIcon('option_a')}
                    <h3 className="text-lg font-semibold">{effectiveChoices?.option_a.label}</h3>
                  </div>
                  {selectedOption === 'option_a' && (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  )}
                </div>
                
                {/* Confidence and Description */}
                <div className="flex items-center justify-between">
                  <Badge className={getConfidenceColor(effectiveChoices?.option_a.confidence || 0)}>
                    {formatConfidence(effectiveChoices?.option_a.confidence || 0)}% confident
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{effectiveChoices?.option_a.description}</p>
                
                <div className="font-mono text-sm bg-card border border-border rounded-lg p-4">
                  "{effectiveChoices?.option_a.transcription}"
                </div>
                
                {/* Show AI consensus badges */}
                {(() => {
                  const primaryModel = extractPrimaryModel(effectiveChoices?.option_a.reasoning || '');
                  const modelAgreement = extractModelAgreement(effectiveChoices?.option_a.reasoning || '');
                  const cleanedReasoning = cleanReasoning(effectiveChoices?.option_a.reasoning || '');
                  
                  if (primaryModel || modelAgreement || cleanedReasoning) {
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Info className="w-3 h-3 text-muted-foreground" />
                          {primaryModel && (
                            <>
                              <span className="text-xs text-muted-foreground font-medium">Primary:</span>
                              <Badge variant="secondary" className="text-xs bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))]/30">
                                {primaryModel}
                              </Badge>
                            </>
                          )}
                          {modelAgreement && (
                            <>
                              <span className="text-xs text-muted-foreground font-medium">Agreement:</span>
                              <Badge variant="secondary" className="text-xs bg-[hsl(var(--sage-green))]/20 text-[hsl(var(--sage-green))] hover:bg-[hsl(var(--sage-green))]/30">
                                {modelAgreement}
                              </Badge>
                            </>
                          )}
                        </div>
                        {cleanedReasoning && (
                          <div className="text-xs text-muted-foreground pl-5">
                            {cleanedReasoning}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          </div>

          {/* OR Separator */}
          <div className="flex items-center justify-center md:px-4">
            <div className="bg-background px-3 py-1 rounded-full border border-border shadow-sm">
              <span className="text-sm font-medium text-muted-foreground">OR</span>
            </div>
          </div>

          {/* Option B - Web Validated (Right) */}
          <div className="flex-1">
            {/* Card bubble */}
            <div 
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg p-6 rounded-xl border-2 ${getSelectionColor('option_b')}`}
              onClick={() => handleOptionSelect('option_b')}
            >
              <div className="space-y-3">
                {/* Header inside card */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getIcon('option_b')}
                    <h3 className="text-lg font-semibold">{effectiveChoices?.option_b.label}</h3>
                  </div>
                  {selectedOption === 'option_b' && (
                    <CheckCircle2 className="w-5 h-5 text-accent" />
                  )}
                </div>
                
                {/* Confidence and Description */}
                <div className="flex items-center justify-between">
                  <Badge className={getConfidenceColor(effectiveChoices?.option_b.confidence || 0)}>
                    {formatConfidence(effectiveChoices?.option_b.confidence || 0)}% confident
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{effectiveChoices?.option_b.description}</p>
                
                <div className="font-mono text-sm bg-card border border-border rounded-lg p-4">
                  "{effectiveChoices?.option_b.transcription}"
                </div>
                
                {/* Show search terms badges */}
                {(() => {
                  const searchTerms = extractSearchTerms(effectiveChoices?.option_b.reasoning || '');
                  const confirmedTerms = extractConfirmedTerms(effectiveChoices?.option_b.reasoning || '');
                  const correctedTerms = extractCorrectedTerms(effectiveChoices?.option_b.reasoning || '');
                  const cleanedReasoning = cleanReasoning(effectiveChoices?.option_b.reasoning || '');
                  
                  if (searchTerms.length > 0 || confirmedTerms.length > 0 || correctedTerms.length > 0 || cleanedReasoning) {
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Info className="w-3 h-3 text-muted-foreground" />
                          {searchTerms.length > 0 && (
                            <>
                              <span className="text-xs text-muted-foreground font-medium">Verified:</span>
                              {searchTerms.map((term, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {term}
                                </Badge>
                              ))}
                            </>
                          )}
                          {confirmedTerms.length > 0 && (
                            <>
                              <span className="text-xs text-muted-foreground font-medium">Confirmed:</span>
                              {confirmedTerms.map((term, index) => (
                                <Badge key={index} variant="secondary" className="text-xs bg-[hsl(var(--sage-green))]/20">
                                  {term}
                                </Badge>
                              ))}
                            </>
                          )}
                          {correctedTerms.length > 0 && (
                            <>
                              <span className="text-xs text-muted-foreground font-medium">Corrected:</span>
                              {correctedTerms.map((term, index) => (
                                <Badge key={index} variant="secondary" className="text-xs bg-[hsl(var(--chip-brown))]/20 text-[hsl(var(--chip-brown))] hover:bg-[hsl(var(--chip-brown))]/30">
                                  {term}
                                </Badge>
                              ))}
                            </>
                          )}
                        </div>
                        {cleanedReasoning && (
                          <div className="text-xs text-muted-foreground pl-5">
                            {cleanedReasoning}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          </div>
          </div>
        )}
      </div>
      ) : null}

      {/* Line Separator - Only show if no error */}
      {!effectiveChoices || (!effectiveChoices.option_a.label.includes('(Error)') && !effectiveChoices.option_b.label.includes('(Error)')) ? (
        <>
          <div className="w-full border-t border-border"></div>

          {/* Confirm Button */}
          <div className="flex justify-center pt-8">
        <Button
          onClick={handleConfirm}
          disabled={!selectedOption || isSubmitting}
          size="lg"
          className="gap-2 px-8 py-3 mt-4 bg-primary hover:bg-primary/90"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Processing...
            </>
          ) : (
            <>
              Continue with {selectedOption && effectiveChoices ? effectiveChoices[selectedOption].label : 'Selection'}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>

          {/* Helper Text */}
          <div className="text-center text-sm text-muted-foreground">
            <p>
              Choose the transcription option that best matches what you heard in the audio.
            </p>
            <p className="mt-1">
              Complete this selection to unlock the next stage in the progress bar above.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
