import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Ribbon } from "@/components/Ribbon";
import { VimToggle } from "@/components/VimToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { TextEditor } from "@/components/TextEditor";
import { AudioUpload } from "@/components/AudioUpload";
import { TranscriptionValidation } from "@/components/TranscriptionValidation";
import { PronounConsolidationStage } from "@/components/PronounConsolidationStage";
import { AccentSelection, type AccentSelection as AccentSelectionType, type LocaleOption, type AccentGroup } from "@/components/AccentSelection";
import { ParticleDetection, type ParticleDetectionData, type PotentialParticle } from "@/components/ParticleDetection";
import { TranscriptionComparison } from "@/components/TranscriptionComparison";
import { DataSourceSelection } from "@/components/DataSourceSelection";
import { StageNavigation } from "@/components/StageNavigation";
import { DockerStatus as ConnectionStatus } from "@/components/DockerStatus";
import { DockerLoadingDialog } from "@/components/DockerLoadingDialog";
import { AdvancedEditorFeaturesDialog } from "@/components/AdvancedEditorFeaturesDialog";
import { UserProfile } from "@/components/UserProfile";
import { Button } from "@/components/ui/button";
import { Volume2, Sparkles, Edit3 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { dockerAPI } from "@/lib/api";

export type WorkflowStage = "mode-selection" | "upload" | "validation" | "editor" | "pronoun-consolidation" | "accent" | "particle-placement" | "comparison" | "submitting" | "completed";

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
  const [selectedAccent, setSelectedAccent] = useState<AccentSelectionType | null>(null);
  const [particleData, setParticleData] = useState<ParticleDetectionData | null>(null);
  const [selectedParticles, setSelectedParticles] = useState<PotentialParticle[]>([]);
  const [userTranscription, setUserTranscription] = useState<string>("");
  const [practiceMode, setPracticeMode] = useState<'practice' | 'upload' | null>(null);
  const [practiceAudioUrl, setPracticeAudioUrl] = useState<string | undefined>(undefined);
  const [practiceGroundTruth, setPracticeGroundTruth] = useState<string | undefined>(undefined);
  const [completedStages, setCompletedStages] = useState<Set<WorkflowStage>>(new Set());
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [selectedPronounConsolidationChoice, setSelectedPronounConsolidationChoice] = useState<'option_a' | 'option_b' | null>(null);
  const [isPracticeLoading, setIsPracticeLoading] = useState(false);
  const [practiceProgress, setPracticeProgress] = useState(0);
  const [showDockerDialog, setShowDockerDialog] = useState(false);
  const [dockerServicesReady, setDockerServicesReady] = useState(false);
  const [showEditorFeaturesDialog, setShowEditorFeaturesDialog] = useState(false);
  const [hasShownEditorToast, setHasShownEditorToast] = useState(false);
  const { toast } = useToast();
  
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
    processedAccents?: Set<string>; // Track which specific accents have been processed
  }>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioSrcRef = useRef<string | null>(null);
  const textEditorRef = useRef<any>(null);

  // Helper function to check if file has changed
  const hasFileChanged = (file?: File) => {
    // For practice mode, compare audio URLs instead of file objects
    if (practiceMode === 'practice') {
      const currentAudioUrl = practiceAudioUrl;
      const lastAudioUrl = cachedResults.practiceAudioUrl;
      const hasChanged = currentAudioUrl !== lastAudioUrl;
      console.log('Practice mode file change check:', { currentAudioUrl, lastAudioUrl, hasChanged });
      return hasChanged;
    }
    
    // For upload mode, compare file objects
    if (!file || !cachedResults.lastProcessedFile) return true;
    
    const currentFile = {
      name: file.name,
      size: file.size,
      lastModified: file.lastModified
    };
    
    const lastFile = cachedResults.lastProcessedFile;
    const hasChanged = (
      currentFile.name !== lastFile.name ||
      currentFile.size !== lastFile.size ||
      currentFile.lastModified !== lastFile.lastModified
    );
    console.log('Upload mode file change check:', { currentFile, lastFile, hasChanged });
    return hasChanged;
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
    setPracticeGroundTruth(undefined);
    setSelectedPronounConsolidationChoice(null);
    
    // Clear session storage as well
    sessionStorage.removeItem('particleData');
    sessionStorage.removeItem('uploadedFileName');
    sessionStorage.removeItem('uploadedFileBlob');
    sessionStorage.removeItem('accentProcessingResult');
    
    // Clear any other potentially problematic cached data
    sessionStorage.clear();
    
    console.log('Cache and all related state cleared, including session storage');
  };

  // Helper function to check if a specific accent has been processed
  const hasAccentBeenProcessed = (accentId: string) => {
    const isProcessed = cachedResults.processedAccents?.has(accentId) || false;
    console.log(`Checking if accent ${accentId} is processed:`, isProcessed, 'Processed accents:', Array.from(cachedResults.processedAccents || []));
    return isProcessed;
  };

  // Helper function to mark an accent as processed
  const markAccentAsProcessed = (accentId: string) => {
    console.log(`Marking accent as processed: ${accentId}`);
    setCachedResults(prev => ({
      ...prev,
      processedAccents: new Set([...(prev.processedAccents || []), accentId])
    }));
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

  // Docker dialog handlers
  const handleServicesReady = () => {
    setDockerServicesReady(true);
    setShowDockerDialog(false);
    // Auto-continue with practice mode now that services are ready
    initiatePracticeMode();
  };

  const handleProceedAnyway = () => {
    setDockerServicesReady(false); // User chose to proceed without full services
    setShowDockerDialog(false);
    // Continue with practice mode despite services not being fully ready
    initiatePracticeMode();
  };

  // Separate function for the actual practice mode logic
  const initiatePracticeMode = async () => {
    console.log('initiatePracticeMode started');
    setIsPracticeLoading(true);
    setPracticeProgress(0);
    try {
      // Fetch random dataset item directly from Supabase
      // First get total count, then get random offset
      const { count } = await supabase
        .from('cv22_clips')
        .select('*', { count: 'exact', head: true });
      
      if (!count || count === 0) {
        throw new Error('No practice clips available in database');
      }
      
      const randomOffset = Math.floor(Math.random() * count);
      
      const { data: randomClipData, error } = await supabase
        .from('cv22_clips')
        .select('id, sentence, path')
        .range(randomOffset, randomOffset)
        .single();

      if (error) {
        throw new Error(`Supabase query failed: ${error.message}`);
      }

      // Extract filename from Supabase storage path
      const getFilenameFromPath = (path: string): string => {
        try {
          const url = new URL(path);
          const pathname = url.pathname;
          const filename = pathname.split('/').pop() || 'unknown_file';
          return filename;
        } catch {
          // Fallback if URL parsing fails
          return path.split('/').pop() || 'unknown_file';
        }
      };

      // Transform to expected format
      const randomClip = {
        clip_id: randomClipData.id,
        sentence: randomClipData.sentence,
        audio_url: randomClipData.path,
        original_filename: getFilenameFromPath(randomClipData.path)
      };
      
      // Store practice clip data for processing
      setPracticeAudioUrl(randomClip.audio_url);
      setAudioFile(undefined); // No local file for practice mode
      
      // Store ground truth for comparison
      setCachedResults(prev => ({
        ...prev,
        practiceGroundTruth: randomClip.sentence,
        practiceAudioUrl: randomClip.audio_url,
        practiceAudioId: randomClip.clip_id, // Store the clip ID for database reference
        practiceFilename: randomClip.original_filename // Store the original filename
      }));
      
      // Store ground truth in state for validation component
      setPracticeGroundTruth(randomClip.sentence);
      
      // Process practice audio directly in background
      console.log('About to process practice audio...');
      await processPracticeAudio(randomClip.audio_url, randomClip.sentence);
      
      // Only proceed if processing succeeded
      console.log('Practice audio processed successfully, going to validation');
      setCurrentStage("validation");
    } catch (error) {
      console.error('Practice mode failed:', error);
      
      // Show error and stay on mode selection
      alert(`Practice Mode Error: ${error.message || 'Failed to load practice data'}\n\nPlease try again or use Upload Mode instead.`);
      
      // Reset to mode selection - don't proceed with broken state
      setCurrentStage("mode-selection");
      setPracticeMode(null);
    } finally {
      setIsPracticeLoading(false);
      setPracticeProgress(0);
    }
  };

  const handleVimToggle = () => {
    setIsVimEnabled(!isVimEnabled);
  };

  const handleClearHighlights = () => {
    // Clear highlights from the text editor
    if (textEditorRef.current?.clearAllHighlights) {
      textEditorRef.current.clearAllHighlights();
    }
    // Also clear the ribbon highlighter selection when clearing highlights
    setSelectedHighlighter(null);
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
        } : prev.lastProcessedFile,
        // For practice mode, ensure practiceAudioUrl is tracked
        practiceAudioUrl: practiceMode === 'practice' ? practiceAudioUrl : prev.practiceAudioUrl
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
    
    // Both upvote and downvote go to pronoun consolidation
    setCurrentStage("pronoun-consolidation");
  };

  const handleEditRequest = async () => {
    console.log('DEBUG: handleEditRequest called');
    console.log('DEBUG: cachedResults.consensusData exists:', !!cachedResults.consensusData);
    
    
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
    }
    setTranscriptionText(newValue);
  };

  // Show editor features toast when entering editor stage
  useEffect(() => {
    if (currentStage === "editor" && !hasShownEditorToast) {
      setHasShownEditorToast(true);
      toast({
        title: "💡 Advanced Editor Features Available",
        description: "This isn't just a text box - discover powerful editing tools like Vim mode, highlighting, and smart features.",
        action: (
          <Button
            onClick={() => setShowEditorFeaturesDialog(true)}
            size="sm"
            className="gap-1 bg-primary hover:bg-primary/90"
          >
            <Sparkles className="h-4 w-4" />
            Explore
          </Button>
        ),
        duration: 10000, // Show for 10 seconds
      });
    }
  }, [currentStage, hasShownEditorToast, toast]);

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

  const handleAccentSelected = async (accentSelection: AccentSelectionType, wasApiProcessed: boolean = false) => {
    setSelectedAccent(accentSelection);
    setCompletedStages(prev => new Set([...prev, "accent"]));
    
    // Only mark accent as processed if it was actually processed via API call
    if (wasApiProcessed) {
      markAccentAsProcessed(accentSelection.id);
    }
    
    // Cache accent selection
    setCachedResults(prev => ({
      ...prev,
      selectedAccentData: accentSelection
    }));
    
    // Check if we have accent processing result from the API call
    const accentProcessingResult = sessionStorage.getItem('accentProcessingResult');
    let particleDataToUse = null;
    
    if (accentProcessingResult) {
      try {
        particleDataToUse = JSON.parse(accentProcessingResult);
        console.log('Using accent-specific particle data from API:', particleDataToUse);
      } catch (error) {
        console.error('Failed to parse accent processing result:', error);
      }
    }
    
    // Fallback to stored particle data if no accent-specific data
    if (!particleDataToUse) {
      const storedParticleData = sessionStorage.getItem('particleData');
      if (storedParticleData) {
        try {
          particleDataToUse = JSON.parse(storedParticleData);
          console.log('Using fallback particle data:', particleDataToUse);
        } catch (error) {
          console.error('Failed to parse stored particle data:', error);
        }
      }
    }
    
    // Set particle data or create fallback
    if (particleDataToUse) {
      particleDataToUse.primary = transcriptionText; // Use the latest transcription
      setParticleData(particleDataToUse);
    } else {
      // Create basic fallback structure
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

  const handleTranscriptionSelected = async (selection: 'ai' | 'user', finalTranscription: string) => {
    setCompletedStages(prev => new Set([...prev, "comparison"]));
    
    // Cache final transcription choice
    setCachedResults(prev => ({
      ...prev,
      finalTranscriptionChoice: { selection, finalTranscription }
    }));
    
    // Show submitting stage
    setCurrentStage("submitting");
    
    // Write to database for both upload and practice modes
    if ((practiceMode === 'upload' || practiceMode === 'practice') && selectedAccent) {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.error('No authenticated user found');
          return;
        }

        // Extract accent name and locale(s) from the accent selection
        let accentName: string;
        let localeCode: string | string[];
        
        if ('locales' in selectedAccent) {
          // Regional group selection
          accentName = selectedAccent.name;
          localeCode = selectedAccent.locales;
        } else {
          // Specific locale selection
          accentName = selectedAccent.name;
          localeCode = selectedAccent.locale;
        }

        // Prepare transcription results for database (unified for both modes)
        const transcriptionResults = {
          consensus_data: cachedResults.consensusData,
          final_selection: selection,
          final_transcription: finalTranscription,
          accent_selection: selectedAccent,
          particles_detected: selectedParticles || [],
          user_transcription: userTranscription,
          workflow_completed_at: new Date().toISOString(),
          session_mode: practiceMode,
          ...(practiceMode === 'practice' && {
            practice_ground_truth: practiceGroundTruth,
            practice_audio_url: practiceAudioUrl
          })
        };

        // Prepare data for unified CV22 schema
        let insertData;
        
        if (practiceMode === 'practice') {
          // Practice mode: Save session data with reference to original clip
          insertData = {
            // CV22 Standard Fields
            client_id: user.email || `user_${user.id}`,
            path: practiceAudioUrl || '', // Original practice clip URL
            sentence: practiceGroundTruth || finalTranscription, // Ground truth sentence
            up_votes: 0,
            down_votes: 0,
            age: null,
            gender: null,
            accents: accentName,
            locale: typeof localeCode === 'string' ? localeCode : localeCode[0],
            segment: null,
            sentence_id: cachedResults.practiceAudioId || `practice_${Date.now()}`,
            
            // Session Fields
            user_id: user.id,
            session_type: 'practice',
            practice_clip_id: cachedResults.practiceAudioId, // Reference to original clip
            validation_status: 'validated', // Use 'validated' instead of 'completed' for practice sessions
            transcription_results: transcriptionResults,
            
            // Upload-specific fields (honest data for practice mode)
            audio_url: practiceAudioUrl, // Same as path - actual CV22 audio URL
            original_filename: cachedResults.practiceFilename, // Use cached practice filename
            file_size_bytes: null, // We don't know the file size of CV22 clips
            file_mime_type: null, // We don't know the MIME type of CV22 clips
            accent_detected: accentName,
            locale_detected: (typeof localeCode === 'string' ? localeCode : localeCode[0])?.substring(0, 10)
          };
        } else {
          // Upload mode: Save user contribution
          const bucketName = "user-contributions";
          const filePath = audioFile?.name || 'unknown';
          const { data: publicUrlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(filePath);

          insertData = {
            // CV22 Standard Fields  
            client_id: user.email || `user_${user.id}`,
            path: publicUrlData.publicUrl,
            sentence: finalTranscription,
            up_votes: 0,
            down_votes: 0,
            age: null, // Could be collected in future
            gender: null, // Could be collected in future  
            accents: accentName,
            locale: (typeof localeCode === 'string' ? localeCode : localeCode[0])?.substring(0, 10),
            segment: null,
            sentence_id: `upload_${Date.now()}`,
            
            
            // Session Fields
            user_id: user.id,
            session_type: 'upload',
            practice_clip_id: null,
            validation_status: 'pending',
            transcription_results: transcriptionResults,
            
            // Upload-specific fields (legacy)
            audio_url: publicUrlData.publicUrl,
            original_filename: audioFile?.name,
            file_size_bytes: audioFile?.size,
            file_mime_type: audioFile?.type,
            accent_detected: accentName,
            locale_detected: (typeof localeCode === 'string' ? localeCode : localeCode[0])?.substring(0, 10)
          };
        }

        // Insert into user_contributions table with unified CV22 schema
        console.log('DEBUG: About to save contribution - FULL DATA:', insertData);
        console.log('DEBUG: Field lengths check:', {
          locale: insertData.locale?.length || 0,
          locale_detected: insertData.locale_detected?.length || 0,
          validation_status: insertData.validation_status?.length || 0,
          session_type: insertData.session_type?.length || 0,
          accents: insertData.accents?.length || 0,
          accent_detected: insertData.accent_detected?.length || 0
        });

        const { data, error } = await supabase
          .from('user_contributions')
          .insert(insertData)
          .select()
          .single();

        console.log('DEBUG: Save contribution result:', {
          success: !error,
          data: data,
          error: error
        });

        if (error) {
          console.error(`Database write failed for ${practiceMode} mode:`, error);
          
          // Check for duplicate file error based on common database constraint violations
          let userFriendlyMessage = "Failed to save your contribution to the database.";
          
          if (error.message?.includes('duplicate') || 
              error.message?.includes('unique') || 
              error.code === '23505' || // PostgreSQL unique violation
              error.message?.includes('already exists')) {
            userFriendlyMessage = "It looks like you've already uploaded this file before. Please try uploading a different audio file.";
          } else if (error.message?.includes('RLS') || 
                     error.message?.includes('row level security') ||
                     error.message?.includes('policy')) {
            userFriendlyMessage = "You don't have permission to save this data. Please make sure you're logged in and try again.";
          } else if (error.message?.includes('network') || 
                     error.message?.includes('connection')) {
            userFriendlyMessage = "Network connection issue. Please check your internet connection and try again.";
          }
          
          // Show user-friendly error message
          alert(userFriendlyMessage);
          
          // Reset to comparison stage so user can try again
          setCurrentStage("comparison");
          return;
        } else {
          console.log(`Successfully saved ${practiceMode} session:`, data);
          console.log('Session type:', practiceMode);
          console.log('Accent saved:', accentName);
          console.log('Locale saved:', localeCode);
          if (practiceMode === 'practice') {
            console.log('Practice clip ID:', cachedResults.practiceAudioId);
            console.log('Ground truth:', practiceGroundTruth);
          }
          
          // Show completion screen after successful database write
          setCurrentStage("completed");
          return; // Don't proceed to handleNext() immediately
        }

      } catch (error) {
        console.error('Error saving contribution:', error);
      }
    }
    
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
        // Editor only accessible from comparison stage
        setCurrentStage("comparison");
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
        // Editor only accessible from comparison stage - go back to comparison
        // Update userTranscription with the edited text
        setUserTranscription(transcriptionText);
        
        // Update cache with the edited transcription
        setCachedResults(prev => ({
          ...prev,
          selectedParticlesData: prev.selectedParticlesData ? {
            ...prev.selectedParticlesData,
            userTranscription: transcriptionText
          } : { particles: selectedParticles, userTranscription: transcriptionText }
        }));
        
        setCompletedStages(prev => new Set([...prev, "editor"]));
        setCurrentStage("comparison");
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
    console.log('Mode selected:', mode);
    
    // Clear cache only when switching between different modes
    if (practiceMode && practiceMode !== mode) {
      console.log(`Switching from ${practiceMode} to ${mode} mode - clearing cache`);
      clearCache();
    }
    
    setPracticeMode(mode);
    setCompletedStages(prev => new Set([...prev, "mode-selection"]));
    if (mode === 'practice') {
      console.log('Starting practice mode...');
      // Fetch random dataset item and go directly to validation
      handlePracticeMode();
    } else {
      console.log('Going to upload stage...');
      // Go to upload stage
      setCurrentStage("upload");
    }
  };

  const processPracticeAudio = async (audioUrl: string, groundTruth: string) => {
    try {
      console.log('Processing practice audio:', audioUrl);
      
      // Start progress simulation
      setPracticeProgress(10);

      // Download the audio file
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`Failed to download practice audio: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioFile = new File([audioBlob], 'practice-audio.mp3', { 
        type: audioBlob.type || 'audio/mp3' 
      });

      setPracticeProgress(25);

      // Process through ASR with ground truth
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('context', 'Practice mode analysis');
      formData.append('ground_truth', groundTruth);

      setPracticeProgress(40);

      const asr_response = await fetch('http://localhost:8000/transcribe-consensus', {
        method: 'POST',
        body: formData,
      });

      setPracticeProgress(80);

      if (!asr_response.ok) {
        const errorData = await asr_response.json();
        throw new Error(errorData.detail || `ASR processing failed: ${asr_response.status}`);
      }

      const result = await asr_response.json();
      
      // Store results and set transcription
      const primaryTranscription = result.primary || groundTruth;
      setTranscriptionText(primaryTranscription);
      
      // Cache the results for the workflow
      setCachedResults(prev => ({
        ...prev,
        consensusData: result
      }));

      // Store for session continuity
      sessionStorage.setItem('particleData', JSON.stringify(result));
      
      // Initialize autocomplete service for practice mode
      try {
        if (result.autocomplete_data) {
          console.log('Initializing autocomplete service for practice mode');
          const autocompleteResponse = await fetch('http://localhost:8000/initialize-autocomplete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(result.autocomplete_data),
          });

          if (autocompleteResponse.ok) {
            console.log('Practice mode autocomplete initialized successfully');
            sessionStorage.setItem('autocompleteReady', JSON.stringify({
              prepared: true,
              timestamp: Date.now(),
              context: 'practice_mode'
            }));
          } else {
            console.warn('Practice mode autocomplete initialization failed');
            sessionStorage.setItem('autocompleteReady', JSON.stringify({
              prepared: false,
              timestamp: Date.now(),
              error: 'initialization_failed'
            }));
          }
        }
      } catch (error) {
        console.warn('Practice mode autocomplete error:', error);
        sessionStorage.setItem('autocompleteReady', JSON.stringify({
          prepared: false,
          timestamp: Date.now(),
          error: 'network_error'
        }));
      }
      
      setPracticeProgress(100);
      console.log('Practice audio processed successfully');
      
    } catch (error) {
      console.error('Practice audio processing failed:', error);
      // Fallback to ground truth
      setTranscriptionText(groundTruth);
      throw error;
    }
  };

  const handlePracticeMode = async () => {
    console.log('handlePracticeMode started');
    
    // Check Docker services first before proceeding
    if (!dockerServicesReady) {
      console.log('Docker services not confirmed ready, showing dialog');
      setShowDockerDialog(true);
      return; // Don't proceed until services are ready or user chooses to proceed anyway
    }
    
    // If services are ready, proceed directly
    await initiatePracticeMode();
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
            <>
              {isPracticeLoading ? (
                <div className="space-y-6 w-full max-w-2xl flex flex-col items-center justify-center">
                  <div className="text-center space-y-4">
                    <div className="p-6 rounded-lg bg-card border border-border shadow-lg">
                      <div className="flex items-center justify-center gap-2 mb-4">
                        <div className="w-3 h-3 rounded-full bg-primary animate-pulse"></div>
                        <span className="text-lg font-medium text-primary">Loading Practice Mode</span>
                      </div>
                      <p className="text-muted-foreground mb-4">
                        Setting up ASR analysis with validated transcription...
                      </p>
                      <div className="space-y-2">
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${practiceProgress}%` }}
                          ></div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {practiceProgress < 25 ? 'Downloading practice audio...' :
                           practiceProgress < 50 ? 'Processing through ASR models...' :
                           practiceProgress < 90 ? 'Analyzing results vs ground truth...' :
                           'Almost ready...'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <DataSourceSelection 
                  onModeSelect={handleModeSelect} 
                  onBack={handleBack}
                />
              )}
            </>
          )}

          {currentStage === "upload" && (
            <div className="space-y-6 w-full max-w-6xl flex flex-col items-center justify-center">
              {/* Page Title - At the tippity top */}
              <div className="text-center">
                <h2 className="text-2xl font-bold">
                  {practiceMode === 'practice' ? 'Practice Mode - ASR Analysis' : 'Upload Audio File'}
                </h2>
                <p className="text-muted-foreground">
                  {practiceMode === 'practice' 
                    ? 'Compare ASR model performance against validated transcription'
                    : 'Select an audio file to transcribe'
                  }
                </p>
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
              practiceGroundTruth={practiceGroundTruth}
              onValidationComplete={handleValidationComplete}
              onBack={handleBack}
              completedStages={completedStages}
              onStageClick={handleStageClick}
              isAudioPlaying={isAudioPlaying}
              onAudioPlayPause={handleAudioPlayPause}
              cachedValidationResult={cachedResults.validationResult}
              onAbort={() => {
                // Clear all state and return to mode selection
                clearCache();
                setCurrentStage("mode-selection");
                setPracticeMode(null);
              }}
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

              {/* Editor Instructions */}
              <div className="w-full">
                <div className="text-left mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Edit3 className="h-6 w-6 text-primary" />
                    <h3 className="text-xl font-semibold">Advanced Text Editor</h3>
                  </div>
                  <p className="text-base text-muted-foreground ml-9">Refine your transcription using professional editing tools and features</p>
                </div>
              </div>

              
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
                  onClearHighlights={handleClearHighlights}
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
                ref={textEditorRef}
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
                onFormattingChange={setActiveFormatting}
                onHighlighterChange={setSelectedHighlighter}
                onClearHighlights={handleClearHighlights}
              />
              
              {/* Clear Button */}
              <div className="w-full flex justify-end">
                <Button
                  onClick={() => {
                    setTranscriptionText("");
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
                  disabled={false}
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
              completedStages={completedStages}
              onStageClick={handleStageClick}
              cachedResults={{
                ...cachedResults,
                processedAccents: cachedResults.processedAccents
              }}
              hasFileChanged={hasFileChanged}
              audioFile={audioFile}
              onCacheUpdate={updateCacheForAccent}
              currentAccent={selectedAccent}
              hasProcessedAccent={selectedAccent ? hasAccentBeenProcessed(selectedAccent.id) : false}
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
              onEditRequest={() => setCurrentStage("editor")}
              onBack={handleBack}
              completedStages={completedStages}
              onStageClick={handleStageClick}
              aiGeneratedTranscription={particleData?.ai_generated_transcription}
              audioFile={audioFile}
              audioUrl={practiceAudioUrl}
              isAudioPlaying={isAudioPlaying}
              onAudioPlayPause={handleAudioPlayPause}
            />
          )}

          {currentStage === "submitting" && (
            <div className="w-full max-w-2xl mx-auto space-y-8 pt-20 mb-8 flex flex-col items-center justify-center min-h-[60vh]">
              <div className="text-center space-y-6">
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary"></div>
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">Submitting Your Contribution</h2>
                  <p className="text-muted-foreground">
                    Saving your transcription and analysis results to the database...
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                  <span>Processing your {practiceMode} session</span>
                </div>
              </div>
            </div>
          )}

          {currentStage === "completed" && (
            <div className="w-full max-w-2xl mx-auto space-y-8 pt-20 mb-8 flex flex-col items-center justify-center min-h-[60vh]">
              <div className="text-center space-y-6">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-primary">
                    <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-primary">Contribution Saved!</h2>
                  <p className="text-muted-foreground">
                    {practiceMode === 'practice' 
                      ? 'Your practice session has been recorded and saved to your history.'
                      : 'Your audio contribution has been uploaded and saved for review.'
                    }
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="bg-card rounded-lg p-4 space-y-2 border border-border">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Session Type:</span>
                      <span className="font-medium capitalize">{practiceMode}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Accent:</span>
                      <span className="font-medium">{selectedAccent?.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Status:</span>
                      <span className="font-medium" style={{ color: 'hsl(var(--sage-green))' }}>
                        {practiceMode === 'practice' ? 'Validated' : 'Pending Review'}
                      </span>
                    </div>
                  </div>
                  <Button 
                    onClick={() => {
                      // Reset everything and start over
                      setCompletedStages(new Set());
                      setTranscriptionText("");
                      setAudioFile(undefined);
                      setPracticeAudioUrl(undefined);
                      setSelectedAccent(null);
                      setParticleData(null);
                      setSelectedParticles([]);
                      setUserTranscription("");
                      setPracticeMode(null);
                      setSelectedPronounConsolidationChoice(null);
                      clearCache();
                      setCurrentStage("mode-selection");
                    }}
                    size="lg" 
                    className="w-full"
                  >
                    Start New Session
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Docker Loading Dialog */}
      <DockerLoadingDialog
        isOpen={showDockerDialog}
        onServicesReady={handleServicesReady}
        onProceedAnyway={handleProceedAnyway}
      />

      {/* Advanced Editor Features Dialog */}
      <AdvancedEditorFeaturesDialog
        isOpen={showEditorFeaturesDialog}
        onClose={() => setShowEditorFeaturesDialog(false)}
      />
    </div>
  );
};

export default Index;
