import { useState, useRef, useEffect } from "react";
import { Ribbon } from "@/components/Ribbon";
import { VimToggle } from "@/components/VimToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { TextEditor } from "@/components/TextEditor";
import { AudioUpload } from "@/components/AudioUpload";
import { TranscriptionValidation } from "@/components/TranscriptionValidation";
import { PronounConsolidationStage } from "@/components/PronounConsolidationStage";
import { AccentSelection, type AccentOption } from "@/components/AccentSelection";
import { ParticleDetection, type ParticleDetectionData, type PotentialParticle } from "@/components/ParticleDetection";
import { TranscriptionComparison } from "@/components/TranscriptionComparison";
import { DataSourceSelection } from "@/components/DataSourceSelection";
import { StageNavigation } from "@/components/StageNavigation";
import { DockerStatus as ConnectionStatus } from "@/components/DockerStatus";
import { UserProfile } from "@/components/UserProfile";
import { Button } from "@/components/ui/button";
import { Volume2 } from "lucide-react";
import { dockerAPI } from "@/lib/api";

export type WorkflowStage = "mode-selection" | "upload" | "validation" | "editor" | "pronoun-consolidation" | "accent" | "particle-placement" | "comparison";

const Index = () => {
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState("Monaco, Menlo, 'Ubuntu Mono', monospace");
  const [selectedHighlighter, setSelectedHighlighter] = useState<string | null>(null);
  const [activeFormatting, setActiveFormatting] = useState<Set<string>>(new Set());
  const [isVimEnabled, setIsVimEnabled] = useState(false);
  const [vimMode, setVimMode] = useState<"NORMAL" | "INSERT" | "VISUAL" | "V-LINE" | "COMMAND">("NORMAL");
  const [transcriptionText, setTranscriptionText] = useState("");
  const [selectedModel, setSelectedModel] = useState("parallel");
  const [selectedAnalysis, setSelectedAnalysis] = useState("basic");
  const [currentStage, setCurrentStage] = useState<WorkflowStage>("mode-selection");
  const [audioFile, setAudioFile] = useState<File | undefined>(undefined);
  const [selectedAccent, setSelectedAccent] = useState<AccentOption | null>(null);
  const [particleData, setParticleData] = useState<ParticleDetectionData | null>(null);
  const [selectedParticles, setSelectedParticles] = useState<PotentialParticle[]>([]);
  const [userTranscription, setUserTranscription] = useState<string>("");
  const [practiceMode, setPracticeMode] = useState<'practice' | 'upload' | null>(null);
  const [practiceAudioUrl, setPracticeAudioUrl] = useState<string | undefined>(undefined);
  const [completedStages, setCompletedStages] = useState<Set<WorkflowStage>>(new Set());
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [hasEditedTranscription, setHasEditedTranscription] = useState(false);
  const [selectedPronounConsolidationChoice, setSelectedPronounConsolidationChoice] = useState<'option_a' | 'option_b' | null>(null);
  
  // Cache for API results to avoid redundant calls
  const [cachedResults, setCachedResults] = useState<{
    consensusData?: any;
    particleDataByAccent?: { [accentKey: string]: ParticleDetectionData };
    lastProcessedFile?: { name: string; size: number; lastModified: number };
    practiceAudioId?: string;
    // Stage-specific cached data
    validationResult?: { isValid: boolean; selectedTranscription?: string };
    pronounConsolidationChoice?: { selectedOption: 'option_a' | 'option_b'; selectedTranscription: string };
    selectedAccentData?: any;
    selectedParticlesData?: { particles: PotentialParticle[]; userTranscription: string };
    finalTranscriptionChoice?: { selection: 'ai' | 'user'; finalTranscription: string };
  }>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioSrcRef = useRef<string | null>(null);

  // Helper function to check if file has changed
  const hasFileChanged = (file?: File) => {
    if (!file || !cachedResults.lastProcessedFile) return true;
    
    const currentFile = {
      name: file.name,
      size: file.size,
      lastModified: file.lastModified
    };
    
    const lastFile = cachedResults.lastProcessedFile;
    return (
      currentFile.name !== lastFile.name ||
      currentFile.size !== lastFile.size ||
      currentFile.lastModified !== lastFile.lastModified
    );
  };

  // Helper function to clear cache
  const clearCache = () => {
    setCachedResults({});
    setAudioFile(undefined);
    setTranscriptionText("");
    setSelectedAccent(null);
    setParticleData(null);
    setSelectedParticles([]);
    setUserTranscription("");
    setCompletedStages(new Set());
    setPracticeAudioUrl(undefined);
    setSelectedPronounConsolidationChoice(null);
    setHasEditedTranscription(false);
    
    // Clear session storage as well
    sessionStorage.removeItem('particleData');
    sessionStorage.removeItem('uploadedFileName');
    sessionStorage.removeItem('uploadedFileBlob');
    
    console.log('Cache and all related state cleared, including session storage');
  };

  // Helper function to update cache for accent-specific particle data
  const updateCacheForAccent = (accentKey: string, particleData: any) => {
    setCachedResults(prev => ({
      ...prev,
      particleDataByAccent: {
        ...prev.particleDataByAccent,
        [accentKey]: particleData
      }
    }));
  };

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
      case "pronoun-consolidation":
        return completedStages.has("pronoun-consolidation");
      case "editor":
        return completedStages.has("editor");
      case "accent":
        return completedStages.has("accent");
      case "particle-placement":
        return completedStages.has("particle-placement");
      case "comparison":
        return completedStages.has("comparison");
      default:
        return false;
    }
  };

  const handleStageClick = (stage: WorkflowStage) => {
    // Only allow navigation to completed stages or current stage (no skipping)
    if (completedStages.has(stage) || stage === currentStage) {
      // Restore cached data when navigating back to completed stages
      restoreStageData(stage);
      setCurrentStage(stage);
    }
  };

  // Helper function to restore cached data for a specific stage
  const restoreStageData = (stage: WorkflowStage) => {
    const cache = cachedResults;
    
    switch (stage) {
      case "pronoun-consolidation":
        if (cache.pronounConsolidationChoice) {
          setSelectedPronounConsolidationChoice(cache.pronounConsolidationChoice.selectedOption);
          setTranscriptionText(cache.pronounConsolidationChoice.selectedTranscription);
        }
        break;
      case "accent":
        if (cache.selectedAccentData) {
          setSelectedAccent(cache.selectedAccentData);
        }
        break;
      case "particle-placement":
        if (cache.selectedParticlesData) {
          setSelectedParticles(cache.selectedParticlesData.particles);
          setUserTranscription(cache.selectedParticlesData.userTranscription);
        }
        break;
      case "comparison":
        // Restore all relevant data for comparison view
        if (cache.selectedAccentData) setSelectedAccent(cache.selectedAccentData);
        if (cache.selectedParticlesData) {
          setSelectedParticles(cache.selectedParticlesData.particles);
          setUserTranscription(cache.selectedParticlesData.userTranscription);
        }
        break;
      default:
        break;
    }
  };

  const handleTranscriptionComplete = async (text: string, file?: File, consensusData?: any) => {
    setTranscriptionText(text);
    setAudioFile(file);
    
    // Cache the consensus data and file info - always cache if we have the data
    if (consensusData) {
      sessionStorage.setItem('particleData', JSON.stringify(consensusData));
      setCachedResults(prev => ({
        ...prev,
        consensusData,
        lastProcessedFile: file ? {
          name: file.name,
          size: file.size,
          lastModified: file.lastModified
        } : prev.lastProcessedFile
      }));

      // Initialize autocomplete service
      try {
        const autocompleteData = {
          final_transcription: consensusData.primary,
          confidence_score: consensusData.metadata?.confidence || 0,
          detected_particles: consensusData.potential_particles || [],
          asr_alternatives: consensusData.alternatives || {},
        };

        const audioIdForAutocomplete = file?.name || 'unknown';

        const initResponse = await fetch('http://localhost:8007/initialize?audio_id=' + audioIdForAutocomplete, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(autocompleteData),
        });
        
        if (initResponse.ok) {
          console.log('Autocomplete service initialized successfully for audio_id:', audioIdForAutocomplete);
        } else {
          console.error('Failed to initialize autocomplete service:', initResponse.status, initResponse.statusText);
        }
      } catch (error) {
        console.error('Failed to initialize autocomplete service:', error);
      }
    }
    
    setCompletedStages(prev => new Set([...prev, "upload"]));
    setCurrentStage("validation");
  };

  const handleValidationComplete = (isValid: boolean, selectedTranscription?: string) => {
    setCompletedStages(prev => new Set([...prev, "validation"]));
    
    // Cache validation result
    setCachedResults(prev => ({
      ...prev,
      validationResult: { isValid, selectedTranscription }
    }));
    
    // If a specific transcription was selected, update the transcription text
    if (selectedTranscription) {
      setTranscriptionText(selectedTranscription);
    }
    
    if (isValid) {
      // Always go to pronoun consolidation stage (step 2)
      setCurrentStage("pronoun-consolidation");
    } else {
      setCurrentStage("editor");
    }
  };

  const handleEditRequest = async () => {
    console.log('DEBUG: handleEditRequest called');
    console.log('DEBUG: cachedResults.consensusData exists:', !!cachedResults.consensusData);
    
    setHasEditedTranscription(completedStages.has("editor")); // Enable if already completed
    
    // Initialize autocomplete service with consensus data
    if (cachedResults.consensusData) {
      try {
        console.log('DEBUG: About to initialize autocomplete with:', {
          audio_filename: cachedResults.consensusData.audio_filename,
          primary: cachedResults.consensusData.primary?.substring(0, 50)
        });
        
        // Use the pre-formatted autocomplete_data if available, otherwise construct it
        const autocompletePayload = cachedResults.consensusData.autocomplete_data || {
          final_transcription: cachedResults.consensusData.primary || '',
          confidence_score: cachedResults.consensusData.metadata?.confidence || 0.8,
          detected_particles: cachedResults.consensusData.potential_particles || [],
          asr_alternatives: cachedResults.consensusData.alternatives || {}
        };
        
        console.log('DEBUG: Sending autocomplete payload:', autocompletePayload);
        
        const response = await fetch('http://localhost:8000/initialize-autocomplete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(autocompletePayload),
        });
        
        if (response.ok) {
          console.log('Autocomplete service initialized successfully');
        } else {
          console.error('Failed to initialize autocomplete service:', response.status);
        }
      } catch (error) {
        console.error('Error initializing autocomplete service:', error);
      }
    }
    
    setCurrentStage("editor");
  };

  

  const handleTranscriptionChoiceSelected = (selectedOption: 'option_a' | 'option_b', selectedTranscription: string) => {
    setSelectedPronounConsolidationChoice(selectedOption);
    setTranscriptionText(selectedTranscription);
    setCompletedStages(prev => new Set([...prev, "pronoun-consolidation"]));
    
    // Cache pronoun consolidation choice
    setCachedResults(prev => ({
      ...prev,
      pronounConsolidationChoice: { selectedOption, selectedTranscription }
    }));
    
    setCurrentStage("accent");
  };

  const handleTranscriptionChange = (newValue: string) => {
    if (newValue !== transcriptionText){
      setHasEditedTranscription(true);
    }
    setTranscriptionText(newValue);
  };

  // Reset editor flag when entering editor stage
  useEffect(() => {
    if (currentStage === "editor") {
      setHasEditedTranscription(completedStages.has("editor"));
    }
  }, [currentStage, completedStages]);

  // Initialize cache from session storage on mount
  useEffect(() => {
    const storedParticleData = sessionStorage.getItem('particleData');
    const storedFileName = sessionStorage.getItem('uploadedFileName');
    const storedFileBlob = sessionStorage.getItem('uploadedFileBlob');
    
    if (storedParticleData && !cachedResults.consensusData) {
      try {
        const result = JSON.parse(storedParticleData);
        setCachedResults(prev => ({
          ...prev,
          consensusData: result
        }));
      } catch (error) {
        console.error('Failed to restore cache from session storage:', error);
      }
    }

    // Restore audio file if we have the data but no current file
    if (storedFileName && storedFileBlob && !audioFile) {
      try {
        fetch(storedFileBlob)
          .then(response => response.blob())
          .then(blob => {
            const restoredFile = new File([blob], storedFileName, { type: blob.type || 'audio/wav' });
            setAudioFile(restoredFile);
            
            // Also restore the file metadata for cache tracking
            setCachedResults(prev => ({
              ...prev,
              lastProcessedFile: {
                name: restoredFile.name,
                size: restoredFile.size,
                lastModified: restoredFile.lastModified
              }
            }));
            
            console.log('Restored audio file from session storage:', storedFileName);
          })
          .catch(error => {
            console.error('Failed to restore audio file:', error);
          });
      } catch (error) {
        console.error('Failed to restore audio file from blob data:', error);
      }
    }
  }, []); // Only run once on mount

  // Restore file from cache when navigating back to upload stage
  useEffect(() => {
    if (currentStage === "upload" && cachedResults.consensusData && !audioFile) {
      const storedFileName = sessionStorage.getItem('uploadedFileName');
      const storedFileBlob = sessionStorage.getItem('uploadedFileBlob');
      const storedParticleData = sessionStorage.getItem('particleData');
      
      // Only restore if ALL required session storage data exists
      if (storedFileName && storedFileBlob && storedParticleData) {
        console.log('Restoring file during navigation back to upload stage...');
        fetch(storedFileBlob)
          .then(response => response.blob())
          .then(blob => {
            const restoredFile = new File([blob], storedFileName, { type: blob.type || 'audio/wav' });
            setAudioFile(restoredFile);
            console.log('Restored file during navigation:', storedFileName);
          })
          .catch(error => {
            console.error('Failed to restore file during navigation:', error);
          });
      } else {
        console.log('File restoration skipped - session storage data missing or incomplete');
      }
    }
  }, [currentStage, cachedResults.consensusData, audioFile]);

  // Restore transcription state when navigating back to upload stage with cached data
  useEffect(() => {
    if (currentStage === "upload" && cachedResults.consensusData && !transcriptionText) {
      setTranscriptionText(cachedResults.consensusData.primary || '');
      setCompletedStages(prev => new Set([...prev, "upload"]));
    }
  }, [currentStage, cachedResults.consensusData, transcriptionText]);

  // Fail-safe: Ensure cache is synchronized when navigating to any stage
  useEffect(() => {
    const storedParticleData = sessionStorage.getItem('particleData');
    const storedFileName = sessionStorage.getItem('uploadedFileName');
    const storedFileBlob = sessionStorage.getItem('uploadedFileBlob');
    
    // Only restore if ALL session storage data exists (prevents partial restoration after file removal)
    if (storedParticleData && storedFileName && storedFileBlob && !cachedResults.consensusData) {
      try {
        const result = JSON.parse(storedParticleData);
        console.log('Fail-safe: Restoring cache from session storage during navigation');
        setCachedResults(prev => ({
          ...prev,
          consensusData: result
        }));
      } catch (error) {
        console.error('Fail-safe cache restoration failed:', error);
      }
    }
  }, [currentStage, cachedResults.consensusData]);

  const handleAccentSelected = async (accent: AccentOption) => {
    setSelectedAccent(accent);
    setCompletedStages(prev => new Set([...prev, "accent"]));
    
    // Cache accent selection
    setCachedResults(prev => ({
      ...prev,
      selectedAccentData: accent
    }));
    
    // Get the particle data from session storage (stored during transcription)
    const storedParticleData = sessionStorage.getItem('particleData');
    
    if (storedParticleData) {
      try {
        const parsedData = JSON.parse(storedParticleData);
        parsedData.primary = transcriptionText; // Use the latest transcription
        setParticleData(parsedData);
      } catch (error) {
        console.error('Failed to parse stored particle data:', error);
        // Fallback to a basic structure
        const fallbackData: ParticleDetectionData = {
          status: "success",
          primary: transcriptionText,
          alternatives: {},
          potential_particles: [],
          metadata: {
            confidence: 0.0,
            processing_time: 0,
            models_used: 0
          }
        };
        setParticleData(fallbackData);
      }
    } else {
      // If no stored data, create basic fallback
      const fallbackData: ParticleDetectionData = {
        status: "success",
        primary: transcriptionText,
        alternatives: {},
        potential_particles: [],
        metadata: {
          confidence: 0.0,
          processing_time: 0,
          models_used: 0
        }
      };
      setParticleData(fallbackData);
    }
    
    setCurrentStage("particle-placement");
  };

  const handleParticlesSelected = (particles: PotentialParticle[], userTranscriptionText: string) => {
    setSelectedParticles(particles);
    setUserTranscription(userTranscriptionText);
    setCompletedStages(prev => new Set([...prev, "particle-placement"]));
    
    // Cache particle selection
    setCachedResults(prev => ({
      ...prev,
      selectedParticlesData: { particles, userTranscription: userTranscriptionText }
    }));
    
    setCurrentStage("comparison");
  };

  const handleTranscriptionSelected = (selection: 'ai' | 'user', finalTranscription: string) => {
    setCompletedStages(prev => new Set([...prev, "comparison"]));
    
    // Cache final transcription choice
    setCachedResults(prev => ({
      ...prev,
      finalTranscriptionChoice: { selection, finalTranscription }
    }));
    
    // Here you would typically submit the final data to the backend/database
    console.log("Selected transcription type:", selection);
    console.log("Final transcription:", finalTranscription);
    console.log("Selected accent:", selectedAccent?.name);
    console.log("Selected particles:", selectedParticles);
    console.log("Complete workflow cache:", cachedResults);
    
    // Reset the workflow
    handleNext();
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
      case "pronoun-consolidation":
        setCurrentStage("validation");
        break;
      case "editor":
        setCurrentStage("validation");
        break;
      case "accent":
        // Step 4: Accent → Pronoun Consolidation (always go back sequentially)
        setCurrentStage("pronoun-consolidation");
        break;
      case "particle-placement":
        setCurrentStage("accent");
        break;
      case "comparison":
        setCurrentStage("particle-placement");
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
        // Step 1: Upload → Validation
        if (cachedResults.consensusData) {
          // Restore transcription text if not already set
          if (!transcriptionText && cachedResults.consensusData.primary) {
            setTranscriptionText(cachedResults.consensusData.primary);
          }
          setCurrentStage("validation");
        }
        break;
      case "validation":
        // Step 2: Validation → Pronoun Consolidation (always)
        setCurrentStage("pronoun-consolidation");
        break;
      case "pronoun-consolidation":
        // Step 3: Pronoun Consolidation → Accent
        setCurrentStage("accent");
        break;
      case "editor":
        // Editor → Pronoun Consolidation (always)
        setCompletedStages(prev => new Set([...prev, "editor"]));
        setCurrentStage("pronoun-consolidation");
        break;
      case "accent":
        // Step 4: Accent → Particle Placement
        setCurrentStage("particle-placement");
        break;
      case "particle-placement":
        // Step 5: Particle Placement → Comparison
        setCurrentStage("comparison");
        break;
      case "comparison":
        // Final stage - reset everything and start over
        setCompletedStages(new Set());
        setHasEditedTranscription(false);
        setTranscriptionText("");
        setAudioFile(undefined);
        setPracticeAudioUrl(undefined);
        setSelectedAccent(null);
        setParticleData(null);
        setSelectedParticles([]);
        setUserTranscription("");
        setPracticeMode(null);
        setSelectedPronounConsolidationChoice(null);
        clearCache(); // Clear cached results when starting over
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
      
      // Initialize autocomplete service for practice mode
      try {
        const practiceAudioId = `practice_${Date.now()}`;
        const autocompleteData = {
          final_transcription: randomClip.sentence,
          confidence_score: 1.0,
          detected_particles: [],
          asr_alternatives: {},
        };

        const initResponse = await fetch('http://localhost:8007/initialize?audio_id=' + practiceAudioId, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(autocompleteData),
        });
        
        if (initResponse.ok) {
          console.log('Autocomplete service initialized successfully for practice mode:', practiceAudioId);
          // Store the practice audio ID for later use in the editor
          setCachedResults(prev => ({
            ...prev,
            practiceAudioId: practiceAudioId
          }));
        } else {
          console.error('Failed to initialize autocomplete service for practice mode:', initResponse.status, initResponse.statusText);
        }
      } catch (error) {
        console.error('Failed to initialize autocomplete service for practice mode:', error);
      }
      
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
          <div className="h-6 w-px bg-muted-foreground/50" />
          <UserProfile />
        </div>
      </header>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col items-center px-6 min-h-0 ${currentStage === "editor" ? "justify-start pt-16 min-h-screen" : "justify-center"}`}>
        
        <div className="w-full max-w-6xl flex justify-center items-center">
          {/* Stage Content */}
          {currentStage === "mode-selection" && (
            <DataSourceSelection 
              onModeSelect={handleModeSelect} 
              onBack={handleBack}
            />
          )}

          {currentStage === "upload" && (
            <div className="space-y-6 w-full max-w-6xl flex flex-col items-center justify-center">
              {/* Page Title - At the tippity top */}
              <div className="text-center">
                <h2 className="text-2xl font-bold">Upload Audio File</h2>
                <p className="text-muted-foreground">Select an audio file to transcribe</p>
              </div>
              
              {/* Debug Info */}
              {/* {process.env.NODE_ENV === 'development' && (
                <div className="text-xs text-muted-foreground p-2 bg-muted rounded max-w-4xl">
                  Debug Cache: consensusData={cachedResults.consensusData ? 'exists' : 'missing'}, 
                  audioFile={audioFile ? audioFile.name : 'none'}, 
                  transcriptionText={transcriptionText ? 'exists' : 'empty'}
                </div>
              )} */}

              <div className="w-full">
                <StageNavigation
                  onBack={handleBack}
                  showNext={true}
                  onNext={handleNext}
                  nextText="Next"
                  nextDisabled={!cachedResults.consensusData}
                />
              </div>
              <AudioUpload
                onTranscriptionComplete={handleTranscriptionComplete}
                selectedModel={selectedModel}
                selectedAnalysis={selectedAnalysis}
                onFileRemoved={clearCache}
                currentFile={audioFile}
                hasProcessedFile={!!cachedResults.consensusData}
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

          {currentStage === "pronoun-consolidation" && (
            <PronounConsolidationStage
              audioFile={audioFile}
              audioUrl={practiceAudioUrl}
              pronounConsolitdationChoices={cachedResults.consensusData?.pronoun_consolidation}
              onChoiceSelected={handleTranscriptionChoiceSelected}
              onBack={handleBack}
              completedStages={completedStages}
              onStageClick={handleStageClick}
              isAudioPlaying={isAudioPlaying}
              onAudioPlayPause={handleAudioPlayPause}
              userEditedTranscription={transcriptionText}
              hasEditedTranscription={hasEditedTranscription}
            />
          )}

          {currentStage === "editor" && (
            <div className="space-y-6 w-full max-w-6xl flex flex-col items-center pb-52">
              {/* Page Title - At the tippity top */}
              <div className="text-center">
                <h2 className="text-2xl font-bold">Edit Transcription</h2>
                <p className="text-muted-foreground">Make any necessary corrections to the transcription</p>
              </div>
              
              {/* Navigation - Second */}
              <div className="w-full">
                <StageNavigation
                  onBack={handleBack}
                  showNext={true}
                  onNext={() => {
                    if (window.confirm("Are you sure you want to continue with this transcription?")) {
                      handleNext();
                    }
                  }}
                  nextText="Next"
                />
              </div>
              
              {/* Duolingo-style Audio Player - Above ribbon */}
              {true && (
                <div className="flex justify-center">
                  <Button
                    onClick={handleAudioPlayPause}
                    disabled={!audioFile && !practiceAudioUrl}
                    className={`
                      px-6 py-4 rounded-2xl transition-all duration-200 
                      ${!audioFile && !practiceAudioUrl 
                        ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50' 
                        : isAudioPlaying 
                          ? 'bg-accent hover:bg-accent/90 text-accent-foreground' 
                          : 'bg-primary hover:bg-primary/90 text-primary-foreground hover:scale-105'
                      }
                      shadow-lg hover:shadow-xl border-b-4 
                      ${!audioFile && !practiceAudioUrl 
                        ? 'border-muted/70' 
                        : isAudioPlaying ? 'border-accent/70' : 'border-primary/70'
                      }
                      ${!audioFile && !practiceAudioUrl ? '' : 'active:border-b-2 active:translate-y-0.5'}
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
                  fontFamily={fontFamily}
                  onFontFamilyChange={setFontFamily}
                  selectedHighlighter={selectedHighlighter}
                  onHighlighterChange={setSelectedHighlighter}
                  activeFormatting={activeFormatting}
                  onFormattingChange={setActiveFormatting}
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
                fontFamily={fontFamily}
                vimMode={vimMode}
                onVimModeChange={setVimMode}
                isVimEnabled={isVimEnabled}
                placeholder="Type your transcription here..."
                initialContent={transcriptionText}
                onChange={handleTranscriptionChange}
                audioId={null}
                highlightColor={selectedHighlighter}
                onHighlightApplied={(from, to, color) => {
                  // Optional: Handle highlight application
                }}
                activeFormatting={activeFormatting}
                onFormattingApplied={(from, to, formats) => {
                  // Optional: Handle formatting application
                }}
              />
              
              {/* Clear Button */}
              <div className="w-full flex justify-end">
                <Button
                  onClick={() => {
                    setTranscriptionText("");
                    setHasEditedTranscription(true);
                  }}
                  variant="destructive"
                  className="border-0"
                  size="sm"
                >
                  Clear
                </Button>
              </div>
              
              {/* Divider */}
              <div className="w-full h-px bg-border"></div>
              
              {/* Spacer to push submit button down */}
              <div className="flex-1"></div>
              
              {/* Submit Button */}
              <div className="flex justify-center">
                <Button
                  onClick={handleNext}
                  disabled={!hasEditedTranscription}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3"
                >
                  Submit Edited Transcription
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground text-center">
                Make corrections using autocomplete suggestions or clear the text to start fresh
              </p>
              
              {/* Bottom spacer */}
              <div className="flex-1"></div>
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
              cachedResults={cachedResults}
              hasFileChanged={hasFileChanged}
              audioFile={audioFile}
              onCacheUpdate={updateCacheForAccent}
              currentAccent={selectedAccent}
              hasProcessedAccent={completedStages.has("accent")}
              audioUrl={practiceAudioUrl}
              isAudioPlaying={isAudioPlaying}
              onAudioPlayPause={handleAudioPlayPause}
            />
          )}

          {currentStage === "particle-placement" && (
            selectedAccent && particleData ? (
              <ParticleDetection
                particleData={particleData}
                selectedAccent={selectedAccent}
                onParticlesSelected={handleParticlesSelected}
                onBack={handleBack}
                onNext={handleNext}
                completedStages={completedStages}
                onStageClick={handleStageClick}
                audioFile={audioFile}
                audioUrl={practiceAudioUrl}
                isAudioPlaying={isAudioPlaying}
                onAudioPlayPause={handleAudioPlayPause}
              />
            ) : (
              <div className="text-center py-12 space-y-6 flex flex-col items-center justify-center">
                <h2 className="text-2xl font-semibold mb-4">Loading Particle Placement...</h2>
                <p className="text-muted-foreground">
                  Current stage: {currentStage}
                  <br />
                  Selected accent: {selectedAccent ? selectedAccent.name : "None"}
                  <br />
                  Particle data: {particleData ? "Available" : "Missing"}
                  <br />
                  Transcription: {transcriptionText || "Empty"}
                </p>
                <Button onClick={() => setCurrentStage("accent")} className="mt-4">
                  Go Back to Accent Selection
                </Button>
                <div className="w-full">
                  <StageNavigation
                    onBack={handleBack}
                    showNext={false}
                  />
                </div>
              </div>
            )
          )}

          {currentStage === "comparison" && selectedAccent && (
            <TranscriptionComparison
              originalTranscription={transcriptionText}
              userTranscription={userTranscription}
              selectedAccent={selectedAccent}
              selectedParticles={selectedParticles}
              onTranscriptionSelected={handleTranscriptionSelected}
              onBack={handleBack}
              completedStages={completedStages}
              onStageClick={handleStageClick}
              aiGeneratedTranscription={particleData?.ai_generated_transcription}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
