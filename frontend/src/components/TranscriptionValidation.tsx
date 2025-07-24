import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Volume2, ThumbsUp, ThumbsDown, Play, Pause, Brain, AlertTriangle, Flag, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
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
  onAbort?: () => void; // Optional abort handler
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
  onAbort,
}: TranscriptionValidationProps) {
  const [selectedValidation, setSelectedValidation] = useState<boolean | null>(null);
  const [hasValidated, setHasValidated] = useState(completedStages.has("validation"));
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState("");
  
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

  const handleReport = () => {
    setShowReportDialog(true);
  };

  const handleReportSubmit = () => {
    if (reportReason.trim()) {
      // Log the report for debugging/tracking
      console.log('Audio/Transcription Report:', {
        reason: reportReason.trim(),
        audioFile: audioFile?.name,
        audioUrl: audioUrl,
        transcription: displayTranscription,
        isPracticeMode,
        timestamp: new Date().toISOString()
      });

      // Close dialog and reset
      setShowReportDialog(false);
      setReportReason("");
      
      // Always end the session when reporting - real issues prevent continuation
      if (onAbort) {
        onAbort();
      } else {
        onBack();
      }
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
            <p className="text-sm text-muted-foreground text-center max-w-md mx-auto">
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
                    <p className="text-sm text-muted-foreground mt-1 text-center">
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
                    <p className="text-sm text-muted-foreground mt-1 text-center">
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

      {/* Report Issue Section - Always visible */}
      <div className="w-full max-w-2xl text-center">
        <Button
          onClick={handleReport}
          variant="outline"
          size="sm"
          className="gap-2 border-[hsl(var(--accent))] text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))]/10"
        >
          <Flag className="h-4 w-4" />
          Report Issue
        </Button>
        <p className="text-xs text-muted-foreground mt-3">
          Having issues with the audio quality or session? Report problems here
        </p>
      </div>

      {/* Line Separator */}
      <div className="w-full border-t border-border"></div>

      {/* Helper Text */}
      <div className="text-center text-sm text-muted-foreground max-w-lg mx-auto py-4">
        <p className="leading-relaxed">
          {isPracticeMode 
            ? "Listen carefully and compare the reference transcription with what you hear. This helps you understand accent recognition challenges."
            : "Listen carefully and compare the transcription with what you hear. Your validation helps track ASR accuracy for research purposes."
          }
        </p>
      </div>

      {/* Report Issue Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-[hsl(var(--accent))]" />
              Report Issue
            </DialogTitle>
            <DialogDescription>
              Help us improve by describing the problem with this audio or transcription.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                What's the issue?
              </label>
              <Textarea
                placeholder="e.g., 'Audio is inaudible', 'Wrong language', 'Audio corruption', 'Silence only', 'Background noise', etc."
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="min-h-[100px] resize-none"
              />
            </div>
            
            <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg">
              <h4 className="text-sm font-medium text-destructive mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Reporting will end this session
              </h4>
              <ul className="text-xs text-destructive space-y-1 mb-3">
                <li>• Your report will help improve the system</li>
                <li>• This session will be terminated</li>
                <li>• You'll return to mode selection</li>
                <li>• No progress will be saved</li>
              </ul>
              <div className="bg-[hsl(var(--accent))]/10 border border-[hsl(var(--accent))]/20 p-2 rounded">
                <p className="text-xs text-[hsl(var(--accent))] font-medium leading-tight">
                  💡 If it's just a minor inconvenience, consider canceling and continuing instead.
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowReportDialog(false);
                setReportReason("");
              }}
              className="w-full sm:w-auto"
            >
              Cancel & Continue Session
            </Button>
            <Button
              onClick={handleReportSubmit}
              disabled={!reportReason.trim()}
              variant="destructive"
              className="w-full sm:w-auto"
            >
              Submit Report & End Session
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}