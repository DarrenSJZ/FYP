import { useState, useRef, useEffect } from "react";
import { Ribbon } from "@/components/Ribbon";
import { VimToggle } from "@/components/VimToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { TextEditor } from "@/components/TextEditor";
import { AudioUpload } from "@/components/AudioUpload";
import { TranscriptionValidation } from "@/components/TranscriptionValidation";
import { AccentSelection, type AccentOption } from "@/components/AccentSelection";
import { DataSourceSelection } from "@/components/DataSourceSelection";
import { StageNavigation } from "@/components/StageNavigation";
import { DockerStatus as ConnectionStatus } from "@/components/DockerStatus";
import { Button } from "@/components/ui/button";
import { Play, Pause, Volume2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dockerAPI } from "@/lib/api";

export type WorkflowStage = "mode-selection" | "upload" | "validation" | "editor" | "accent" | "particles";

const Index = () => {
  const [fontSize, setFontSize] = useState(24);
  const [isVimEnabled, setIsVimEnabled] = useState(false);
  const [vimMode, setVimMode] = useState<"NORMAL" | "INSERT" | "VISUAL" | "V-LINE" | "COMMAND">("NORMAL");
  const [transcriptionText, setTranscriptionText] = useState("");
  const [selectedModel, setSelectedModel] = useState("parallel");
  const [selectedAnalysis, setSelectedAnalysis] = useState("basic");
  const [currentStage, setCurrentStage] = useState<WorkflowStage>("mode-selection");
  const [audioFile, setAudioFile] = useState<File | undefined>(undefined);
  const [selectedAccent, setSelectedAccent] = useState<AccentOption | null>(null);
  const [practiceMode, setPracticeMode] = useState<'practice' | 'upload' | null>(null);
  const [practiceAudioUrl, setPracticeAudioUrl] = useState<string | undefined>(undefined);
  const [completedStages, setCompletedStages] = useState<Set<WorkflowStage>>(new Set());
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [hasEditedTranscription, setHasEditedTranscription] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioSrcRef = useRef<string | null>(null);

  const handleVimToggle = () => {
    setIsVimEnabled(!isVimEnabled);
  };

  const handleAudioPlayPause = () => {
    if (isAudioPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsAudioPlaying(false);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.play();
        setIsAudioPlaying(true);
      } else {
        let audioSrc: string;
        
        if (audioFile) {
          audioSrc = URL.createObjectURL(audioFile);
        } else if (practiceAudioUrl) {
          audioSrc = practiceAudioUrl;
        } else {
          return;
        }
        
        const audio = new Audio(audioSrc);
        audioRef.current = audio;
        audioSrcRef.current = audioSrc;
        
        setIsAudioPlaying(true);
        audio.play();
        
        audio.onended = () => {
          setIsAudioPlaying(false);
          audioRef.current = null;
          if (audioFile && audioSrcRef.current) {
            URL.revokeObjectURL(audioSrcRef.current);
            audioSrcRef.current = null;
          }
        };
        
        audio.onerror = () => {
          setIsAudioPlaying(false);
          audioRef.current = null;
          if (audioFile && audioSrcRef.current) {
            URL.revokeObjectURL(audioSrcRef.current);
            audioSrcRef.current = null;
          }
        };
      }
    }
  };

  const canNavigateToStage = (stage: WorkflowStage): boolean => {
    return completedStages.has(stage);
  };

  const canNavigateNext = (): boolean => {
    switch (currentStage) {
      case "validation":
        return completedStages.has("validation");
      case "editor":
        return completedStages.has("editor");
      case "accent":
        return completedStages.has("accent");
      case "particles":
        return completedStages.has("particles");
      default:
        return false;
    }
  };

  const handleStageClick = (stage: WorkflowStage) => {
    if (completedStages.has(stage) || stage === currentStage) {
      setCurrentStage(stage);
    }
  };

  const handleTranscriptionComplete = (text: string, file?: File) => {
    setTranscriptionText(text);
    setAudioFile(file);
    setCompletedStages(prev => new Set([...prev, "upload"]));
    setCurrentStage("validation");
  };

  const handleValidationComplete = (isValid: boolean) => {
    setCompletedStages(prev => new Set([...prev, "validation"]));
    if (isValid) {
      setCurrentStage("accent");
    } else {
      setCurrentStage("editor");
    }
  };

  const handleEditRequest = () => {
    setHasEditedTranscription(completedStages.has("editor")); // Enable if already completed
    setCurrentStage("editor");
  };

  const handleEditComplete = () => {
    setCompletedStages(prev => new Set([...prev, "editor"]));
    setCurrentStage("accent");
  };

  const handleTranscriptionChange = (newValue: string) => {
    if (newValue !== transcriptionText) {
      setHasEditedTranscription(true);
      setTranscriptionText(newValue);
    }
  };

  // Reset editor flag when entering editor stage
  useEffect(() => {
    if (currentStage === "editor") {
      setHasEditedTranscription(completedStages.has("editor"));
    }
  }, [currentStage, completedStages]);

  const handleAccentSelected = (accent: AccentOption) => {
    setSelectedAccent(accent);
    setCompletedStages(prev => new Set([...prev, "accent"]));
    setCurrentStage("particles");
  };

  const handleBack = () => {
    switch (currentStage) {
      case "upload":
        setCurrentStage("mode-selection");
        break;
      case "validation":
        if (practiceMode === "practice") {
          setCurrentStage("mode-selection");
        } else {
          setCurrentStage("upload");
        }
        break;
      case "editor":
        setCurrentStage("validation");
        break;
      case "accent":
        setCurrentStage("validation");
        break;
      case "particles":
        setCurrentStage("accent");
        break;
      default:
        break;
    }
  };

  const handleNext = () => {
    switch (currentStage) {
      case "mode-selection":
        // Handled by mode selection
        break;
      case "upload":
        // Handled by upload completion
        break;
      case "validation":
        setCurrentStage("accent");
        break;
      case "editor":
        setCurrentStage("validation");
        break;
      case "accent":
        setCurrentStage("particles");
        break;
      case "particles":
        // Final stage - reset everything and start over
        setCompletedStages(new Set());
        setHasEditedTranscription(false);
        setTranscriptionText("");
        setAudioFile(undefined);
        setPracticeAudioUrl(undefined);
        setSelectedAccent(null);
        setPracticeMode(null);
        setCurrentStage("mode-selection");
        break;
      default:
        break;
    }
  };

  const handleModeSelect = (mode: 'practice' | 'upload') => {
    setPracticeMode(mode);
    setCompletedStages(prev => new Set([...prev, "mode-selection"]));
    if (mode === 'practice') {
      // Fetch random dataset item and go directly to validation
      handlePracticeMode();
    } else {
      // Go to upload stage
      setCurrentStage("upload");
    }
  };

  const handlePracticeMode = async () => {
    try {
      // Fetch random dataset item from backend
      const randomClip = await dockerAPI.getRandomClip();
      
      setTranscriptionText(randomClip.sentence);
      setPracticeAudioUrl(randomClip.audio_url);
      setAudioFile(undefined); // No file for practice mode
      setCurrentStage("validation");
    } catch (error) {
      console.error('Failed to fetch practice dataset:', error);
      // Fallback to error message in transcription text
      setTranscriptionText('Failed to load practice audio. Please check your backend connection and try again.');
      setCurrentStage("validation");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header Section */}
      <header className="w-full flex items-center justify-between p-6 border-b border-border">
        <div className="flex items-center justify-center gap-3">
          <img 
            src="/favicon.ico" 
            alt="Accentric Logo" 
            className="w-11 h-11"
          />
          <span className="text-2xl font-semibold text-foreground flex items-center">Accentric</span>
        </div>
        
        <div className="flex items-center gap-3">
          <ConnectionStatus />
          <ThemeToggleButton />
        </div>
      </header>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col items-center px-6 min-h-0 ${currentStage === "editor" ? "justify-start pt-16" : "justify-center"}`}>
        
        <div className="w-full max-w-6xl flex justify-center">
          {/* Stage Content */}
          {currentStage === "mode-selection" && (
            <DataSourceSelection 
              onModeSelect={handleModeSelect} 
              onBack={handleBack}
            />
          )}

          {currentStage === "upload" && (
            <div className="space-y-6 w-full max-w-6xl">
              {/* Page Title - At the tippity top */}
              <div className="text-center">
                <h2 className="text-2xl font-bold">Upload Audio File</h2>
                <p className="text-muted-foreground">Select an audio file to transcribe</p>
              </div>
              
              <StageNavigation
                onBack={handleBack}
                showNext={false}
              />
              <AudioUpload
                onTranscriptionComplete={handleTranscriptionComplete}
                selectedModel={selectedModel}
                selectedAnalysis={selectedAnalysis}
              />
            </div>
          )}

          {currentStage === "validation" && (
            <TranscriptionValidation
              audioFile={audioFile}
              audioUrl={practiceAudioUrl}
              originalTranscription={transcriptionText}
              onValidationComplete={handleValidationComplete}
              onEditRequest={handleEditRequest}
              onBack={handleBack}
              onNext={handleNext}
              completedStages={completedStages}
              onStageClick={handleStageClick}
            />
          )}

          {currentStage === "editor" && (
            <div className="space-y-6 w-full max-w-6xl">
              {/* Page Title - At the tippity top */}
              <div className="text-center">
                <h2 className="text-2xl font-bold">Edit Transcription</h2>
                <p className="text-muted-foreground">Make any necessary corrections to the transcription</p>
              </div>
              
              {/* Navigation - Second */}
              <StageNavigation
                onBack={handleBack}
                onNext={handleEditComplete}
                nextText="Next"
                nextDisabled={!hasEditedTranscription}
              />
              
              {/* Duolingo-style Audio Player - Above ribbon */}
              {(audioFile || practiceAudioUrl) && (
                <div className="flex justify-center">
                  <Button
                    onClick={handleAudioPlayPause}
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
              
              {/* Ribbon and Toggles Row - Below audio player */}
              <div className="flex items-start justify-center gap-4">
                <Ribbon
                  fontSize={fontSize}
                  onFontSizeChange={setFontSize}
                />
                
                {/* VIM Toggle positioned to the right with gap */}
                <VimToggle
                  isVimEnabled={isVimEnabled}
                  vimMode={vimMode}
                  onVimToggle={handleVimToggle}
                />
                
                {/* Theme Toggle */}
                <ThemeToggle />
              </div>
              
              {/* Text Editor */}
              <TextEditor
                fontSize={fontSize}
                vimMode={vimMode}
                onVimModeChange={setVimMode}
                isVimEnabled={isVimEnabled}
                initialContent={transcriptionText}
                onChange={handleTranscriptionChange}
              />
            </div>
          )}

          {currentStage === "accent" && (
            <AccentSelection
              transcriptionText={transcriptionText}
              onAccentSelected={handleAccentSelected}
              onBack={handleBack}
              onNext={handleNext}
              completedStages={completedStages}
              onStageClick={handleStageClick}
            />
          )}

          {currentStage === "particles" && (
            <div className="text-center py-12 space-y-6">
              <h2 className="text-2xl font-semibold mb-4">Particle Placement</h2>
              <p className="text-muted-foreground">Stage 3: Particle placement coming soon...</p>
              <StageNavigation
                onBack={handleBack}
                onNext={handleNext}
                nextText="Start Over"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
