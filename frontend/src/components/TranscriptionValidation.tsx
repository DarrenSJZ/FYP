import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Volume2, Edit3, Play, Pause, Speaker } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StageNavigation } from "./StageNavigation";
import { StageProgressBar } from "./StageProgressBar";
import type { WorkflowStage } from "@/pages/Index";

interface TranscriptionValidationProps {
  audioFile?: File;
  audioUrl?: string; // For practice mode
  originalTranscription: string;
  onValidationComplete: (isValid: boolean) => void;
  onEditRequest: () => void;
  onBack: () => void;
  onNext?: () => void;
  completedStages: Set<WorkflowStage>;
  onStageClick?: (stage: WorkflowStage) => void;
}

export function TranscriptionValidation({
  audioFile,
  audioUrl,
  originalTranscription,
  onValidationComplete,
  onEditRequest,
  onBack,
  onNext,
  completedStages,
  onStageClick,
}: TranscriptionValidationProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasValidated, setHasValidated] = useState(completedStages.has("validation"));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioSrcRef = useRef<string | null>(null);

  // Update validation state when completedStages changes
  useEffect(() => {
    setHasValidated(completedStages.has("validation"));
  }, [completedStages]);

  const handlePlayPause = () => {
    if (isPlaying) {
      // Pause the audio
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    } else {
      // Play the audio
      if (audioRef.current) {
        // Resume existing audio
        audioRef.current.play();
        setIsPlaying(true);
      } else {
        // Create new audio
        let audioSrc: string;
        
        if (audioFile) {
          audioSrc = URL.createObjectURL(audioFile);
        } else if (audioUrl) {
          audioSrc = audioUrl;
        } else {
          return;
        }
        
        const audio = new Audio(audioSrc);
        audioRef.current = audio;
        audioSrcRef.current = audioSrc;
        
        setIsPlaying(true);
        audio.play();
        
        audio.onended = () => {
          setIsPlaying(false);
          audioRef.current = null;
          if (audioFile && audioSrcRef.current) {
            URL.revokeObjectURL(audioSrcRef.current);
            audioSrcRef.current = null;
          }
        };
        
        audio.onerror = () => {
          setIsPlaying(false);
          audioRef.current = null;
          if (audioFile && audioSrcRef.current) {
            URL.revokeObjectURL(audioSrcRef.current);
            audioSrcRef.current = null;
          }
        };
      }
    }
  };

  const handleYes = () => {
    setHasValidated(true);
    onValidationComplete(true);
  };

  const handleNo = () => {
    setHasValidated(true);
    onValidationComplete(false);
    onEditRequest();
  };

  // Cleanup audio when component unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioFile && audioSrcRef.current) {
        URL.revokeObjectURL(audioSrcRef.current);
        audioSrcRef.current = null;
      }
    };
  }, [audioFile]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 flex flex-col items-center justify-center">
      {/* Stage Header - At the tippity top */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Transcription Validation</h2>
        <p className="text-muted-foreground">
          Please verify if the transcription below matches the audio
        </p>
      </div>

      {/* Progress Bar - Second */}
      <StageProgressBar
        currentStage="validation"
        completedStages={completedStages}
        onStageClick={onStageClick}
      />

      {/* Navigation - Third */}
      <div className="w-full">
        <StageNavigation
          onBack={onBack}
          onNext={onNext}
          nextText="Next"
          nextDisabled={!hasValidated}
        />
      </div>

      {/* Duolingo-style Audio Button - Above transcription */}
      {true && (
        <div className="flex justify-center">
          <Button
            onClick={handlePlayPause}
            disabled={!audioFile && !audioUrl}
            className={`
              px-6 py-4 rounded-2xl transition-all duration-200 
              ${!audioFile && !audioUrl 
                ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50' 
                : isPlaying 
                  ? 'bg-accent hover:bg-accent/90 text-accent-foreground' 
                  : 'bg-primary hover:bg-primary/90 text-primary-foreground hover:scale-105'
              }
              shadow-lg hover:shadow-xl border-b-4 
              ${!audioFile && !audioUrl 
                ? 'border-muted/70' 
                : isPlaying ? 'border-accent/70' : 'border-primary/70'
              }
              ${!audioFile && !audioUrl ? '' : 'active:border-b-2 active:translate-y-0.5'}
            `}
          >
            <div className="flex items-center gap-3">
              <div className={`transition-transform duration-200 ${isPlaying ? 'animate-pulse' : ''}`}>
                <Volume2 className={`h-6 w-6 ${isPlaying ? 'animate-bounce' : ''}`} />
              </div>
              <div className="flex gap-1">
                <div className={`w-1 ${isPlaying ? 'bg-accent-foreground' : 'bg-primary-foreground'} rounded-full ${isPlaying ? 'h-4 animate-pulse' : 'h-2'} transition-all duration-300`}></div>
                <div className={`w-1 ${isPlaying ? 'bg-accent-foreground' : 'bg-primary-foreground'} rounded-full ${isPlaying ? 'h-6 animate-pulse' : 'h-2'} transition-all duration-300 delay-75`}></div>
                <div className={`w-1 ${isPlaying ? 'bg-accent-foreground' : 'bg-primary-foreground'} rounded-full ${isPlaying ? 'h-3 animate-pulse' : 'h-2'} transition-all duration-300 delay-150`}></div>
                <div className={`w-1 ${isPlaying ? 'bg-accent-foreground' : 'bg-primary-foreground'} rounded-full ${isPlaying ? 'h-5 animate-pulse' : 'h-2'} transition-all duration-300 delay-225`}></div>
              </div>
            </div>
          </Button>
        </div>
      )}

      {/* Transcription Display - Boxed */}
      <div className="text-center space-y-6">
        <h3 className="text-lg font-medium text-muted-foreground">Generated Transcription</h3>
        <div className="max-w-2xl mx-auto">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <p className="text-lg leading-relaxed text-left">
              {originalTranscription || "No transcription available"}
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Review the automatically generated transcription above
        </p>
      </div>

      {/* Validation Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button
          onClick={handleYes}
          size="lg"
          className="gap-2 px-8 py-3 text-white"
          style={{backgroundColor: 'hsl(var(--sage-green))'}}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'hsl(var(--sage-green) / 0.9)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'hsl(var(--sage-green))'}
        >
          <CheckCircle className="h-5 w-5" />
          Yes, this is correct
        </Button>
        
        <Button
          onClick={handleNo}
          size="lg"
          className="gap-2 px-8 py-3 text-white"
          style={{backgroundColor: 'hsl(var(--dusty-rose))'}}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'hsl(var(--dusty-rose) / 0.9)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'hsl(var(--dusty-rose))'}
        >
          <XCircle className="h-5 w-5" />
          No, needs correction
        </Button>
      </div>

      {/* Helper Text */}
      <div className="text-center text-sm text-muted-foreground">
        <p>
          Click <strong>"Yes"</strong> if the transcription is correct, or <strong>"No"</strong> to edit it.
        </p>
        <p className="mt-1">
          Complete this validation to unlock the next stage in the progress bar above.
        </p>
      </div>

    </div>
  );
}