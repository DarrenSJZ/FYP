import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Volume2, Brain, Search, CheckCircle2, ArrowRight, Info } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { StageNavigation } from "./StageNavigation";
import { StageProgressBar } from "./StageProgressBar";
import type { WorkflowStage } from "@/pages/Index";

interface TranscriptionChoice {
  transcription: string;
  label: string;
  description: string;
  confidence: number;
  reasoning: string;
}

interface PronounConsolidationStageProps {
  audioFile?: File;
  audioUrl?: string;
  transcriptionChoices: {
    option_a: TranscriptionChoice;
    option_b: TranscriptionChoice;
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
  transcriptionChoices,
  onChoiceSelected,
  onBack,
  completedStages,
  onStageClick,
  isAudioPlaying,
  onAudioPlayPause
}: PronounConsolidationStageProps) {
  const [selectedOption, setSelectedOption] = useState<'option_a' | 'option_b' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const areTranscriptionsDifferent = transcriptionChoices.option_a.transcription !== transcriptionChoices.option_b.transcription;

  useEffect(() => {
    if (!areTranscriptionsDifferent) {
      toast({
        title: "💡 Options are Identical",
        description: "Both options are identical because the web validation confirmed the AI consensus was already correct.",
        variant: "default",
        duration: 5000,
      });
    }
  }, [areTranscriptionsDifferent, toast]);

  const handleOptionSelect = (option: 'option_a' | 'option_b') => {
    setSelectedOption(option);
  };

  const handleConfirm = async () => {
    if (!selectedOption) return;

    setIsSubmitting(true);
    const selectedTranscription = transcriptionChoices[selectedOption].transcription;
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

      {/* Transcription Options - Left/Right Layout */}
      <div className="w-full max-w-6xl">
        <div className="flex flex-col md:flex-row gap-8 items-stretch">
          {/* Option A - AI Consensus (Left) */}
          <div className="flex-1 space-y-4">
            {/* Header outside the card - Fixed height */}
            <div className="flex flex-col justify-center items-center text-center">
              <div className="flex items-center gap-3 mb-2">
                {getIcon('option_a')}
                <h3 className="text-lg font-semibold">{transcriptionChoices.option_a.label}</h3>
                <Badge className={getConfidenceColor(transcriptionChoices.option_a.confidence)}>
                  {formatConfidence(transcriptionChoices.option_a.confidence)}% confident
                </Badge>
                {selectedOption === 'option_a' && (
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">{transcriptionChoices.option_a.description}</p>
            </div>
            
            {/* Card bubble */}
            <div 
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg p-6 rounded-xl border-2 ${getSelectionColor('option_a')}`}
              onClick={() => handleOptionSelect('option_a')}
            >
              <div className="space-y-3">
                <div className="font-mono text-sm bg-card border border-border rounded-lg p-4">
                  "{transcriptionChoices.option_a.transcription}"
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="w-3 h-3" />
                  <span>{transcriptionChoices.option_a.reasoning}</span>
                </div>
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
          <div className="flex-1 space-y-4">
            {/* Header outside the card - Fixed height */}
            <div className="flex flex-col justify-center items-center text-center">
              <div className="flex items-center gap-3 mb-2">
                {getIcon('option_b')}
                <h3 className="text-lg font-semibold">{transcriptionChoices.option_b.label}</h3>
                <Badge className={getConfidenceColor(transcriptionChoices.option_b.confidence)}>
                  {formatConfidence(transcriptionChoices.option_b.confidence)}% confident
                </Badge>
                {selectedOption === 'option_b' && (
                  <CheckCircle2 className="w-5 h-5 text-accent" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">{transcriptionChoices.option_b.description}</p>
            </div>
            
            {/* Card bubble */}
            <div 
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg p-6 rounded-xl border-2 ${getSelectionColor('option_b')}`}
              onClick={() => handleOptionSelect('option_b')}
            >
              <div className="space-y-3">
                <div className="font-mono text-sm bg-card border border-border rounded-lg p-4">
                  "{transcriptionChoices.option_b.transcription}"
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="w-3 h-3" />
                  <span>{transcriptionChoices.option_b.reasoning}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      

      {/* Line Separator */}
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
              Continue with {selectedOption ? transcriptionChoices[selectedOption].label : 'Selection'}
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
    </div>
  );
}