import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, ArrowRight, CheckCircle, ChevronDown, CheckCircle2, Volume2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StageNavigation } from "./StageNavigation";
import { StageProgressBar } from "./StageProgressBar";
import type { WorkflowStage } from "@/pages/Index";

export interface AccentOption {
  id: string;
  name: string;
  description: string;
  examples: string[];
  region: string;
  discourseParticles?: string; // For Docker system
}

interface AccentSelectionProps {
  transcriptionText: string;
  onAccentSelected: (accent: AccentOption) => void;
  onBack: () => void;
  onNext?: () => void;
  completedStages: Set<WorkflowStage>;
  onStageClick?: (stage: WorkflowStage) => void;
  cachedResults?: {
    particleDataByAccent?: { [accentKey: string]: any };
    lastProcessedFile?: { name: string; size: number; lastModified: number };
  };
  hasFileChanged?: (file?: File) => boolean;
  audioFile?: File;
  onCacheUpdate?: (accentKey: string, particleData: any) => void;
  currentAccent?: AccentOption | null;
  hasProcessedAccent?: boolean;
  audioUrl?: string;
  isAudioPlaying?: boolean;
  onAudioPlayPause?: () => void;
}

const accentOptions: AccentOption[] = [
  {
    id: "southeast-asian",
    name: "Southeast Asian",
    description: "Malaysian, Singaporean, Filipino accents",
    examples: ["la", "lor", "leh", "mah", "wan"],
    region: "Southeast Asia",
    discourseParticles: "southeast_asian"
  },
  {
    id: "british",
    name: "British",
    description: "UK English with British expressions",
    examples: ["innit", "mate", "cheers", "blimey", "brilliant"],
    region: "United Kingdom",
    discourseParticles: "british"
  },
  {
    id: "indian",
    name: "Indian",
    description: "Indian English with local expressions",
    examples: ["na", "yaar", "bhai", "achha", "bas"],
    region: "India",
    discourseParticles: "indian"
  },
  {
    id: "american",
    name: "American",
    description: "Standard American English",
    examples: ["dude", "awesome", "totally", "gonna", "wanna"],
    region: "United States",
    discourseParticles: "american"
  },
  {
    id: "australian",
    name: "Australian",
    description: "Australian English expressions",
    examples: ["mate", "bloody", "fair dinkum", "no worries", "crikey"],
    region: "Australia",
    discourseParticles: "australian"
  }
];

const otherAccentOptions: AccentOption[] = [
  {
    id: "canadian",
    name: "Canadian",
    description: "Canadian English expressions",
    examples: ["eh", "about", "sorry", "hoser", "double-double"],
    region: "Canada",
    discourseParticles: "canadian"
  },
  {
    id: "south-african",
    name: "South African",
    description: "South African English expressions",
    examples: ["ag", "boet", "lekker", "shame", "braai"],
    region: "South Africa",
    discourseParticles: "south_african"
  },
  {
    id: "irish",
    name: "Irish",
    description: "Irish English expressions",
    examples: ["craic", "grand", "feck", "sound", "banter"],
    region: "Ireland",
    discourseParticles: "irish"
  },
  {
    id: "scottish",
    name: "Scottish",
    description: "Scottish English expressions",
    examples: ["aye", "wee", "ken", "bonnie", "dinnae"],
    region: "Scotland",
    discourseParticles: "scottish"
  },
  {
    id: "new-zealand",
    name: "New Zealand",
    description: "New Zealand English expressions",
    examples: ["choice", "yeah nah", "sweet as", "bro", "chur"],
    region: "New Zealand",
    discourseParticles: "new_zealand"
  },
  {
    id: "unknown",
    name: "Unknown",
    description: "Let AI automatically detect the accent and particles",
    examples: ["auto-detect", "AI-guided", "unsure"],
    region: "Auto-detect",
    discourseParticles: "unknown"
  },
  {
    id: "none",
    name: "None",
    description: "No specific accent or particles",
    region: "None",
    discourseParticles: "none"
  }
];

export function AccentSelection({ transcriptionText, onAccentSelected, onBack, onNext, completedStages, onStageClick, cachedResults, hasFileChanged, audioFile, onCacheUpdate, currentAccent, hasProcessedAccent, audioUrl, isAudioPlaying = false, onAudioPlayPause }: AccentSelectionProps) {
  const [selectedAccent, setSelectedAccent] = useState<AccentOption | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Restore accent state when component mounts with existing accent
  useEffect(() => {
    if (currentAccent && !selectedAccent) {
      setSelectedAccent(currentAccent);
    }
  }, [currentAccent, selectedAccent]);

  const handleAccentSelect = (accent: AccentOption) => {
    setSelectedAccent(accent);
  };

  const handleContinue = async () => {
    if (!selectedAccent) return;
    
    const accentKey = selectedAccent.discourseParticles || 'unknown';
    
    // console.log('DEBUG: handleContinue called with:', {
    //   selectedAccent: selectedAccent.name,
    //   accentKey,
    //   hasProcessedAccent,
    //   currentAccentId: currentAccent?.id,
    //   selectedAccentId: selectedAccent.id,
    //   fileChanged: hasFileChanged?.(audioFile),
    //   cachedDataExists: !!cachedResults?.particleDataByAccent?.[accentKey]
    // });
    
    // Check if this accent has already been processed for the current file
    const fileHasChanged = hasFileChanged?.(audioFile);
    const isAlreadyProcessed = hasProcessedAccent && currentAccent?.id === selectedAccent.id && !fileHasChanged;

    if (isAlreadyProcessed) {
      console.log(`Accent ${selectedAccent.name} already processed for this file. Skipping API call.`);
      onAccentSelected(selectedAccent);
      return;
    }
    
    console.log(`Making API call for accent-specific particle filtering: ${accentKey}`);
    setIsProcessing(true);
    
    try {
      // Add a small delay to ensure loading screen shows
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Make API call to get accent-specific particle suggestions using cached data
      console.log('Making API call with accent:', selectedAccent.name);
      
      // Get cached consensus data from session storage
      const storedParticleData = sessionStorage.getItem('particleData');
      if (!storedParticleData) {
        console.error('No cached consensus data available - user may have refreshed or navigated away');
        setIsProcessing(false);
        // Show user-friendly error and redirect back to upload
        alert('Session data lost. Please upload your audio file again.');
        window.location.reload(); // Or navigate back to upload stage
        return;
      }
      
      // Validate that the cached data is valid JSON and has required structure
      let parsedData;
      try {
        parsedData = JSON.parse(storedParticleData);
        if (!parsedData.primary || !parsedData.asr_results) {
          throw new Error('Invalid cached data structure - missing primary or asr_results');
        }
        // Verify we have Allosaurus data for particle detection
        const allosaurus = parsedData.asr_results?.results?.allosaurus;
        if (!allosaurus || allosaurus.status !== 'success') {
          console.warn('No valid Allosaurus data available for particle detection');
        }
      } catch (error) {
        console.error('Invalid cached consensus data:', error);
        setIsProcessing(false);
        alert('Cached data is corrupted or incomplete. Please upload your audio file again.');
        window.location.reload();
        return;
      }
      
      // Make API call with selected accent using cached consensus data
      const formData = new FormData();
      formData.append('consensus_data', storedParticleData);
      formData.append('context', `Accent-specific particle detection for ${selectedAccent.name} accent`);
      const accentHint = selectedAccent.discourseParticles || 'unknown';
      formData.append('accent_hint', accentHint);
        
      console.log('=== DEBUGGING ACCENT SELECTION ===');
      console.log('selectedAccent object:', selectedAccent);
      console.log('selectedAccent.discourseParticles:', selectedAccent.discourseParticles);
      console.log('accentHint being sent:', accentHint);
      console.log('FormData contents:');
      for (let [key, value] of formData.entries()) {
        console.log(`  ${key}: ${value}`);
      }
      console.log('=== END DEBUGGING ===');
      
      const apiResponse = await fetch('http://localhost:8000/transcribe-with-particles', {
        method: 'POST',
        body: formData,
      });
      
      if (apiResponse.ok) {
        const result = await apiResponse.json();
        
        // Update particle data with accent-specific results
        const updatedParticleData = {
          ...result,
          accent_selected: selectedAccent.discourseParticles
        };
        
        // Store the updated result
        sessionStorage.setItem('particleData', JSON.stringify(updatedParticleData));
        
        // Update cache in parent component
        onCacheUpdate?.(accentKey, updatedParticleData);
        
        console.log('Accent-specific API call successful:', result);
      } else {
        console.error('Accent-specific API call failed:', apiResponse.statusText);
      }
      
      // Continue to next stage regardless of API success (fallback to existing data)
      onAccentSelected(selectedAccent);
    } catch (error) {
      console.error('Failed to send accent selection to backend:', error);
      // Continue to next stage even if API fails
      onAccentSelected(selectedAccent);
    } finally {
      setIsProcessing(false);
    }
  };

  // Show loading screen when processing
  if (isProcessing) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-8 pt-12 pb-12 flex flex-col items-center justify-center">
        <div className="text-center space-y-6">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Processing Accent Selection</h2>
            <p className="text-muted-foreground">
              Generating accent-specific particle suggestions for {selectedAccent?.name} accent...
            </p>
          </div>
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 max-w-md mx-auto">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span className="text-sm">Analyzing audio with {selectedAccent?.name} accent context</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <span className="text-sm">Detecting {selectedAccent?.name} discourse particles</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                <span className="text-sm">Generating particle placement suggestions</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 pt-12 pb-12">
      {/* Progress Bar - Second */}
      <div className="w-full">
        <StageProgressBar
          currentStage="accent"
          completedStages={completedStages}
          onStageClick={onStageClick}
        />
      </div>

      {/* Stage Header - At the tippity top */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Accent Selection</h2>
        <p className="text-muted-foreground">
          Based on the transcription, which accent do you think the speaker has?
        </p>
      </div>

      {/* Debug Info */}
      {/* {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
          Debug: hasProcessedAccent={hasProcessedAccent ? 'true' : 'false'}, 
          currentAccent={currentAccent?.name || 'none'} (id: {currentAccent?.id || 'none'}), 
          selectedAccent={selectedAccent?.name || 'none'} (id: {selectedAccent?.id || 'none'}),
          cachedAccents={Object.keys(cachedResults?.particleDataByAccent || {}).join(', ') || 'none'},
          fileChanged={hasFileChanged?.(audioFile) ? 'true' : 'false'}
        </div>
      )} */}

      {/* Navigation - Third */}
      <div className="w-full">
        <StageNavigation
          onBack={onBack}
          onNext={handleContinue}
          nextText="Next"
          nextDisabled={!selectedAccent || isProcessing}
        />
      </div>

      {/* Audio Player */}
      {(audioFile || audioUrl) && onAudioPlayPause && (
        <div className="flex justify-center">
          <Button
            onClick={onAudioPlayPause}
            disabled={!audioFile && !audioUrl}
            className={`
              px-6 py-4 rounded-2xl transition-all duration-200 
              ${!audioFile && !audioUrl 
                ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50' 
                : isAudioPlaying 
                  ? 'bg-accent hover:bg-accent/90 text-accent-foreground' 
                  : 'bg-primary hover:bg-primary/90 text-primary-foreground hover:scale-105'
              }
              shadow-lg hover:shadow-xl border-b-4 
              ${!audioFile && !audioUrl 
                ? 'border-muted/70' 
                : isAudioPlaying ? 'border-accent/70' : 'border-primary/70'
              }
              ${!audioFile && !audioUrl ? '' : 'active:border-b-2 active:translate-y-0.5'}
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

      {/* Transcription Preview - Minimal */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Current Transcription</h3>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm max-h-32 overflow-y-auto">
          <p className="text-sm leading-relaxed">
            {transcriptionText}
          </p>
        </div>
      </div>

      {/* Accent Options - Minimal */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Select the accent you hear:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {accentOptions.map((accent) => (
            <div
              key={accent.id}
              className={`cursor-pointer transition-all duration-200 p-4 rounded-xl border-2 ${
                selectedAccent?.id === accent.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
              onClick={() => handleAccentSelect(accent)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold">{accent.name}</h4>
                    {selectedAccent?.id === accent.id && (
                      <CheckCircle className="h-4 w-4 text-primary" />
                    )}
                    {hasProcessedAccent && currentAccent?.id === accent.id && (
                      <Badge variant="secondary" className="text-xs flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Processed
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {accent.description}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {accent.examples.map((example, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="text-xs"
                      >
                        {example}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {/* Other Accents Dropdown - Minimal */}
          <div className="cursor-pointer transition-all duration-200 p-4 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-muted/30">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center justify-between w-full">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">Other Accents</h4>
                      <ChevronDown className="h-4 w-4" />
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      More accent options from around the world
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="text-xs">Canadian</Badge>
                      <Badge variant="secondary" className="text-xs">Irish</Badge>
                      <Badge variant="secondary" className="text-xs">Scottish</Badge>
                      <Badge variant="secondary" className="text-xs">+ more</Badge>
                      </div>
                    </div>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64">
                  {otherAccentOptions.map((accent) => (
                    <DropdownMenuItem
                      key={accent.id}
                      onClick={() => handleAccentSelect(accent)}
                      className="cursor-pointer"
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{accent.name}</span>
                          {selectedAccent?.id === accent.id && (
                            <CheckCircle className="h-3 w-3 text-primary" />
                          )}
                          {hasProcessedAccent && currentAccent?.id === accent.id && (
                            <Badge variant="secondary" className="text-xs flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Processed
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{accent.region}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="w-full flex justify-between items-center pb-6 border-b border-border"></div>

      {/* Continue Button */}
      <div className="flex justify-center pt-4">
        <Button
          onClick={handleContinue}
          disabled={!selectedAccent || isProcessing}
          size="lg"
          className="gap-2 px-8"
        >
          {isProcessing ? "Processing..." : hasProcessedAccent && currentAccent?.id === selectedAccent?.id ? "Continue with Selected Accent" : "Process Selected Accent"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Helper Text */}
      <div className="text-center text-sm text-muted-foreground">
        <p>
          Select the accent that best matches what you hear in the audio. This will help with particle placement.
        </p>
        <p className="mt-1">
          Click "Continue" to complete this stage and unlock particle placement in the progress bar above.
        </p>
      </div>

    </div>
  );
}