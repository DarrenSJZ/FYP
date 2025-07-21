import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Volume2, ThumbsUp, ThumbsDown, Play, Pause, Brain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StageNavigation } from "./StageNavigation";
import { StageProgressBar } from "./StageProgressBar";
import type { WorkflowStage } from "@/pages/Index";

interface TranscriptionValidationProps {
  audioFile?: File;
  audioUrl?: string; // For practice mode
  originalTranscription: string;
  practiceGroundTruth?: string; // Ground truth sentence for practice mode
  onValidationComplete: (asrWasCorrect: boolean) => void;
  onBack: () => void;
  completedStages: Set<WorkflowStage>;
  onStageClick?: (stage: WorkflowStage) => void;
  isAudioPlaying?: boolean;
  onAudioPlayPause?: () => void;
  cachedValidationResult?: { isValid: boolean; selectedTranscription?: string };
}

export function TranscriptionValidation({
  audioFile,
  audioUrl,
  originalTranscription,
  practiceGroundTruth,
  onValidationComplete,
  onBack,
  completedStages,
  onStageClick,
  isAudioPlaying = false,
  onAudioPlayPause,
  cachedValidationResult,
}: TranscriptionValidationProps) {
  const [selectedValidation, setSelectedValidation] = useState<boolean | null>(null);
  const [hasValidated, setHasValidated] = useState(completedStages.has("validation"));
  
  // Determine if this is practice mode
  const isPracticeMode = !!audioUrl && !!practiceGroundTruth;
  
  // Use ground truth for practice mode, AI transcription for upload mode
  const displayTranscription = isPracticeMode ? practiceGroundTruth : originalTranscription;
  
  // Check if transcription failed
  const isTranscriptionFailed = originalTranscription.includes('Transcription failed') || 
                                originalTranscription.includes('Please check your backend connection') ||
                                originalTranscription === 'No transcription available' ||
                                originalTranscription.trim() === '';

  // Update validation state when completedStages changes
  useEffect(() => {
    setHasValidated(completedStages.has("validation"));
  }, [completedStages]);

  // Restore validation selection from cache when component mounts
  useEffect(() => {
    if (cachedValidationResult && selectedValidation === null) {
      setSelectedValidation(cachedValidationResult.isValid);
    }
  }, [cachedValidationResult, selectedValidation]);

  const handleValidation = (asrWasCorrect: boolean) => {
    setSelectedValidation(asrWasCorrect);
    onValidationComplete(asrWasCorrect);
  };

  const handleNext = () => {
    if (selectedValidation !== null) {
      onValidationComplete(selectedValidation);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 flex flex-col items-center justify-center pt-12 pb-12">
      {/* Progress Bar */}
      <StageProgressBar
        currentStage="validation"
        completedStages={completedStages}
        onStageClick={onStageClick}
      />

      {/* Stage Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">ASR Quality Validation</h2>
        <p className="text-muted-foreground">
          Listen to the audio and verify if the AI transcription is correct
        </p>
      </div>

      {/* Navigation */}
      <div className="w-full">
        <StageNavigation
          onBack={onBack}
          onNext={handleNext}
          nextText="Next"
          nextDisabled={selectedValidation === null}
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

      {/* Transcription Display - Minimal Design */}
      <div className="w-full max-w-2xl space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Brain className="h-5 w-5" />
          <span className="text-base font-medium">
            {isPracticeMode ? "Reference Transcription" : "AI Transcription"}
          </span>
        </div>
        
        {isTranscriptionFailed ? (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-center">
            <XCircle className="h-6 w-6 text-destructive mx-auto mb-2" />
            <p className="text-destructive font-medium">Transcription Failed</p>
            <p className="text-sm text-muted-foreground mt-1">
              The AI could not process this audio. Please try a different file.
            </p>
          </div>
        ) : (
          <div className="p-6 bg-card border border-border rounded-2xl">
            <p className="text-lg font-mono text-left leading-relaxed">
              "{displayTranscription}"
            </p>
          </div>
        )}
      </div>

      {/* Validation Buttons */}
      {!isTranscriptionFailed && (
        <div className="w-full max-w-2xl">
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold mb-2">
              {isPracticeMode ? "Does this match what you hear?" : "Is this transcription correct?"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isPracticeMode 
                ? "Compare the reference transcription above with the audio you hear" 
                : "Your feedback helps improve AI transcription quality"
              }
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Correct/Upvote */}
            <Card 
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                selectedValidation === true
                  ? "border-[hsl(var(--sage-green))] bg-[hsl(var(--sage-green))]/10"
                  : "border-border hover:border-[hsl(var(--sage-green))]/50"
              }`}
              onClick={() => handleValidation(true)}
            >
              <CardContent className="p-6 text-center relative">
                {selectedValidation === true && (
                  <CheckCircle className="h-5 w-5 text-[hsl(var(--sage-green))] absolute top-4 right-4" />
                )}
                <div className="flex flex-col items-center gap-3">
                  <ThumbsUp className={`h-8 w-8 text-[hsl(var(--sage-green))]`} />
                  <div>
                    <h4 className="font-semibold text-[hsl(var(--sage-green))]">
                      {isPracticeMode ? "Yes, Matches" : "Yes, Correct"}
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {isPracticeMode 
                        ? "The reference transcription matches what I hear"
                        : "The transcription matches the audio perfectly"
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Incorrect/Downvote */}
            <Card 
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                selectedValidation === false
                  ? "border-destructive bg-destructive/10"
                  : "border-border hover:border-destructive/50"
              }`}
              onClick={() => handleValidation(false)}
            >
              <CardContent className="p-6 text-center relative">
                {selectedValidation === false && (
                  <CheckCircle className="h-5 w-5 text-destructive absolute top-4 right-4" />
                )}
                <div className="flex flex-col items-center gap-3">
                  <ThumbsDown className={`h-8 w-8 text-destructive`} />
                  <div>
                    <h4 className="font-semibold text-destructive">
                      {isPracticeMode ? "No, Different" : "No, Incorrect"}
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {isPracticeMode 
                        ? "The reference transcription doesn't match what I hear"
                        : "The transcription has errors or missing words"
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Line Separator */}
      {!isTranscriptionFailed && (
        <div className="w-full border-t border-border"></div>
      )}

      {/* Helper Text */}
      <div className="text-center text-sm text-muted-foreground max-w-md mx-auto py-4">
        <p>
          {isPracticeMode 
            ? "Listen carefully and compare the reference transcription with what you hear. This helps you understand accent recognition challenges."
            : "Listen carefully and compare the transcription with what you hear. Your validation helps track ASR accuracy for research purposes."
          }
        </p>
      </div>
    </div>
  );
}