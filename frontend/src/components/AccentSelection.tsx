import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, ArrowRight, CheckCircle, ChevronDown, CheckCircle2, Volume2, Loader2, Brain } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StageNavigation } from "./StageNavigation";
import { StageProgressBar } from "./StageProgressBar";
import type { WorkflowStage } from "@/pages/Index";

// Specific country/region variant for dropdown selection
export interface LocaleOption {
  id: string;
  name: string; // "Malaysian English"
  flag: string; // "🇲🇾"
  locale: string; // "en-MY" 
  group: string; // "southeast-asian"
  particles: string[]; // ["la", "lor", "leh"]
  discourseParticles: string; // "malaysian" - specific backend key
}

// Regional accent group for quick bubble selection
export interface AccentGroup {
  id: string; // "southeast-asian"
  name: string; // "Southeast Asian"
  description: string;
  examples: string[]; // Combined examples from all countries
  region: string;
  locales: string[]; // ["en-MY", "en-SG", "en-PH"]
  combinedParticles: string[]; // Merged particles from all countries
  discourseParticles: string; // "southeast_asian_combined"
  defaultLocale?: string; // "en-MY" - default for this group
  flags: string[]; // ["🇲🇾", "🇸🇬", "🇵🇭"] - flags for countries in this group
}

// Union type for selections
export type AccentSelection = LocaleOption | AccentGroup;

interface AccentSelectionProps {
  transcriptionText: string;
  onAccentSelected: (selection: AccentSelection, wasApiProcessed?: boolean) => void;
  onBack: () => void;
  onNext?: () => void;
  completedStages: Set<WorkflowStage>;
  onStageClick?: (stage: WorkflowStage) => void;
  cachedResults?: {
    particleDataByAccent?: { [accentKey: string]: any };
    lastProcessedFile?: { name: string; size: number; lastModified: number };
    processedAccents?: Set<string>;
  };
  hasFileChanged?: (file?: File) => boolean;
  audioFile?: File;
  onCacheUpdate?: (accentKey: string, particleData: any) => void;
  currentAccent?: any;
  hasProcessedAccent?: boolean;
  audioUrl?: string;
  isAudioPlaying?: boolean;
  onAudioPlayPause?: () => void;
}

// Comprehensive specific locale options for dropdown
const localeOptions: LocaleOption[] = [
  // Southeast Asian variants
  { id: "malaysian", name: "Malaysian English", flag: "🇲🇾", locale: "en-MY", group: "southeast-asian", particles: ["la", "lor", "leh", "mah", "wan", "kan", "ya", "cis", "wei", "nia"], discourseParticles: "malaysian" },
  { id: "singaporean", name: "Singaporean English", flag: "🇸🇬", locale: "en-SG", group: "southeast-asian", particles: ["lah", "leh", "lor", "meh", "sia", "ceh", "hor", "what", "liao", "arh"], discourseParticles: "singaporean" },
  { id: "filipino", name: "Filipino English", flag: "🇵🇭", locale: "en-PH", group: "southeast-asian", particles: ["po", "opo", "ano", "kasi", "naman"], discourseParticles: "filipino" },
  
  // North American variants
  { id: "american", name: "American English", flag: "🇺🇸", locale: "en-US", group: "north-american", particles: ["dude", "awesome", "totally", "gonna", "wanna"], discourseParticles: "american" },
  { id: "canadian", name: "Canadian English", flag: "🇨🇦", locale: "en-CA", group: "north-american", particles: ["eh", "about", "sorry", "hoser", "double-double"], discourseParticles: "canadian" },
  
  // British Isles variants  
  { id: "british", name: "British English", flag: "🇬🇧", locale: "en-GB", group: "british-isles", particles: ["innit", "mate", "cheers", "blimey", "brilliant"], discourseParticles: "british" },
  { id: "irish", name: "Irish English", flag: "🇮🇪", locale: "en-IE", group: "british-isles", particles: ["craic", "grand", "feck", "sound", "banter"], discourseParticles: "irish" },
  { id: "scottish", name: "Scottish English", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", locale: "en-GB", group: "british-isles", particles: ["aye", "wee", "ken", "bonnie", "dinnae"], discourseParticles: "scottish" },
  
  // Oceanic variants
  { id: "australian", name: "Australian English", flag: "🇦🇺", locale: "en-AU", group: "oceanic", particles: ["mate", "bloody", "fair dinkum", "no worries", "crikey"], discourseParticles: "australian" },
  { id: "new-zealand", name: "New Zealand English", flag: "🇳🇿", locale: "en-NZ", group: "oceanic", particles: ["choice", "yeah nah", "sweet as", "bro", "chur"], discourseParticles: "new_zealand" },
  
  // Other variants
  { id: "indian", name: "Indian English", flag: "🇮🇳", locale: "en-IN", group: "south-asian", particles: ["na", "yaar", "bhai", "achha", "bas"], discourseParticles: "indian" },
  { id: "south-african", name: "South African English", flag: "🇿🇦", locale: "en-ZA", group: "african", particles: ["ag", "boet", "lekker", "shame", "braai"], discourseParticles: "south_african" },
  { id: "jamaican", name: "Jamaican English", flag: "🇯🇲", locale: "en-JM", group: "caribbean", particles: ["bredrin", "big up", "irie", "seen", "wha gwaan"], discourseParticles: "jamaican" },
  
  // Middle Eastern variants
  { id: "lebanese", name: "Lebanese English", flag: "🇱🇧", locale: "en-LB", group: "middle-eastern", particles: ["yalla", "habibi", "khalas", "inshallah", "mashallah"], discourseParticles: "lebanese" },
  { id: "emirati", name: "Emirati English", flag: "🇦🇪", locale: "en-AE", group: "middle-eastern", particles: ["yalla", "habibi", "khalas", "wallah", "mashallah"], discourseParticles: "emirati" },
];

// Regional accent groups for quick bubble selection
const accentGroups: AccentGroup[] = [
  {
    id: "southeast-asian",
    name: "Southeast Asian",
    description: "Malaysian, Singaporean, Filipino accents",
    examples: ["la", "lor", "leh", "lah", "sia", "po", "ano"],
    region: "Southeast Asia",
    locales: ["en-MY", "en-SG", "en-PH"],
    combinedParticles: ["la", "lor", "leh", "mah", "wan", "kan", "ya", "cis", "wei", "nia", "lah", "meh", "sia", "ceh", "hor", "what", "liao", "arh", "po", "opo", "ano", "kasi", "naman"],
    discourseParticles: "southeast_asian_combined",
    defaultLocale: "en-MY",
    flags: ["🇲🇾", "🇸🇬", "🇵🇭"]
  },
  {
    id: "north-american", 
    name: "North American",
    description: "American and Canadian English",
    examples: ["dude", "awesome", "eh", "sorry"],
    region: "North America",
    locales: ["en-US", "en-CA"],
    combinedParticles: ["dude", "awesome", "totally", "gonna", "wanna", "eh", "about", "sorry", "hoser", "double-double"],
    discourseParticles: "north_american_combined",
    defaultLocale: "en-US",
    flags: ["🇺🇸", "🇨🇦"]
  },
  {
    id: "british-isles",
    name: "British Isles", 
    description: "British, Irish, Scottish accents",
    examples: ["innit", "mate", "craic", "aye"],
    region: "British Isles",
    locales: ["en-GB", "en-IE"],
    combinedParticles: ["innit", "mate", "cheers", "blimey", "brilliant", "craic", "grand", "feck", "sound", "aye", "wee", "ken"],
    discourseParticles: "british_isles_combined",
    defaultLocale: "en-GB",
    flags: ["🇬🇧", "🇮🇪", "🏴󠁧󠁢󠁳󠁣󠁴󠁿"]
  },
  {
    id: "oceanic",
    name: "Oceanic",
    description: "Australian and New Zealand English", 
    examples: ["mate", "bloody", "choice", "bro"],
    region: "Oceania",
    locales: ["en-AU", "en-NZ"],
    combinedParticles: ["mate", "bloody", "fair dinkum", "no worries", "crikey", "choice", "yeah nah", "sweet as", "bro", "chur"],
    discourseParticles: "oceanic_combined",
    defaultLocale: "en-AU",
    flags: ["🇦🇺", "🇳🇿"]
  },
  {
    id: "middle-eastern",
    name: "Middle Eastern",
    description: "Lebanese, Emirati, Gulf English",
    examples: ["yalla", "habibi", "khalas", "wallah"],
    region: "Middle East",
    locales: ["en-LB", "en-AE"],
    combinedParticles: ["yalla", "habibi", "khalas", "inshallah", "mashallah", "wallah"],
    discourseParticles: "middle_eastern_combined",
    defaultLocale: "en-LB",
    flags: ["🇱🇧", "🇦🇪"]
  },
  {
    id: "unknown",
    name: "Unknown",
    description: "Let AI automatically detect the accent and particles",
    examples: ["auto-detect", "AI-guided"],
    region: "Auto-detect",
    locales: ["en"],
    combinedParticles: [],
    discourseParticles: "unknown",
    flags: ["🤖"]
  }
];

export function AccentSelection({ 
  transcriptionText, 
  onAccentSelected, 
  onBack, 
  onNext, 
  completedStages, 
  onStageClick, 
  cachedResults,
  hasFileChanged,
  audioFile,
  onCacheUpdate,
  currentAccent,
  hasProcessedAccent,
  audioUrl, 
  isAudioPlaying = false, 
  onAudioPlayPause 
}: AccentSelectionProps) {
  const [selectedAccentSelection, setSelectedAccentSelection] = useState<AccentSelection | null>(null);
  const [selectedLocale, setSelectedLocale] = useState<LocaleOption | null>(null); // Start with no selection
  const [isProcessing, setIsProcessing] = useState(false);

  // Restore accent state when component mounts with existing accent
  useEffect(() => {
    if (currentAccent && !selectedAccentSelection) {
      setSelectedAccentSelection(currentAccent);
    }
  }, [currentAccent, selectedAccentSelection]);

  const handleGroupSelect = (group: AccentGroup) => {
    setSelectedAccentSelection(group);
  };

  const handleLocaleSelect = (locale: LocaleOption) => {
    setSelectedAccentSelection(locale);
    setSelectedLocale(locale);
  };

  const handleContinue = async () => {
    if (!selectedAccentSelection) return;
    
    const accentKey = selectedAccentSelection.discourseParticles || 'unknown';
    
    // Check if this accent has already been processed for the current file
    const fileHasChanged = hasFileChanged?.(audioFile);
    const isAlreadyProcessed = hasProcessedAccent && 
      currentAccent?.id === selectedAccentSelection.id && 
      !fileHasChanged;

    // Debug logging
    console.log('Accent processing check:', {
      hasProcessedAccent,
      currentAccentId: currentAccent?.id,
      selectedAccentId: selectedAccentSelection.id,
      fileHasChanged,
      isAlreadyProcessed
    });

    if (isAlreadyProcessed) {
      console.log(`Accent ${selectedAccentSelection.name} already processed for this file. Skipping API call.`);
      onAccentSelected(selectedAccentSelection, false); // Not a new API processing
      return;
    }
    
    console.log(`Making API call for accent-specific particle filtering: ${accentKey}`);
    setIsProcessing(true);
    
    try {
      // Check if we have cached results for this accent
      const cachedData = cachedResults?.particleDataByAccent?.[accentKey];
      if (cachedData && !fileHasChanged) {
        console.log(`Using cached data for accent: ${accentKey}`);
        onAccentSelected(selectedAccentSelection, false); // Using cache, not new processing
        setIsProcessing(false);
        return;
      }

      if (!audioFile && !audioUrl) {
        console.error('No audio file or URL provided for particle detection');
        onAccentSelected(selectedAccentSelection, false); // No processing done
        setIsProcessing(false);
        return;
      }

      // Add a small delay to ensure loading screen shows
      await new Promise(resolve => setTimeout(resolve, 500));

      const formData = new FormData();
      
      if (audioFile) {
        formData.append('file', audioFile);
      } else if (audioUrl) {
        // For practice mode, we need to download the audio first or pass the URL
        console.log('Practice mode: using audio URL for API call');
        formData.append('audio_url', audioUrl);
      }

      const sessionParticleData = sessionStorage.getItem('particleData');
      if (!sessionParticleData) {
        throw new Error('No consensus data available in session storage. Please complete the consensus stage first.');
      }

      const particleData = JSON.parse(sessionParticleData);
      if (!particleData) {
        throw new Error('Failed to parse consensus data from session storage.');
      }

      formData.append('consensus_data', JSON.stringify(particleData));
      formData.append('transcription_text', transcriptionText);

      // Use the accent-specific particle set for API call
      formData.append('accent_selection', accentKey);

      // Add context hint for the LLM
      formData.append('context', `Accent-specific particle detection for ${selectedAccentSelection.name} accent`);
      formData.append('accent_hint', accentKey);
      
      // Debug log for verification
      console.log('selectedAccentSelection object:', selectedAccentSelection);
      console.log('selectedAccentSelection.discourseParticles:', selectedAccentSelection.discourseParticles);

      const response = await fetch('http://localhost:8000/transcribe-with-particles', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Cache the result
      onCacheUpdate?.(accentKey, result);
      
      // Store result in session storage for later use
      sessionStorage.setItem('accentProcessingResult', JSON.stringify(result));

      onAccentSelected(selectedAccentSelection, true); // Mark as API processed
      
    } catch (error) {
      console.error('Error processing accent-specific transcription:', error);
      onAccentSelected(selectedAccentSelection, false); // Error occurred, not processed
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 flex flex-col items-center justify-center pt-12 pb-12">
      {/* Progress Bar */}
      <StageProgressBar
        currentStage="accent"
        completedStages={completedStages}
        onStageClick={onStageClick}
      />

      {/* Stage Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Accent & Locale Selection</h2>
        <p className="text-muted-foreground">
          Choose your accent/dialect for accurate particle detection
        </p>
      </div>

      {/* Navigation */}
      <div className="w-full">
        <StageNavigation
          onBack={onBack}
          onNext={handleContinue}
          nextText="Next"
          nextDisabled={!selectedAccentSelection || isProcessing}
        />
      </div>


      {/* Audio Player */}
      {audioUrl && (
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

      {/* Selected Transcription Display */}
      <div className="w-full max-w-2xl space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground justify-center">
          <Brain className="h-5 w-5" />
          <span className="text-base font-medium">Selected Transcription</span>
        </div>
        <div className="p-6 bg-card border border-border rounded-2xl">
          <p className="text-lg font-mono text-center leading-relaxed">
            "{transcriptionText}"
          </p>
        </div>
      </div>

      {/* Regional Groups */}
      <div className="w-full">
        <div className="text-left mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Globe className="h-6 w-6 text-primary" />
            <h3 className="text-xl font-semibold">Quick Regional Selection</h3>
          </div>
          <p className="text-base text-muted-foreground ml-9">Choose a regional group for common particles</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accentGroups.map((group) => (
            <Card
              key={group.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg rounded-2xl ${
                selectedAccentSelection?.id === group.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
              onClick={() => handleGroupSelect(group)}
            >
              <CardHeader className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="flex gap-1">
                    {group.flags.slice(0, 3).map((flag, index) => (
                      <span key={index} className="text-lg">{flag}</span>
                    ))}
                    {group.flags.length > 3 && (
                      <span className="text-xs text-muted-foreground">+{group.flags.length - 3}</span>
                    )}
                  </div>
                  <CardTitle className="text-lg">{group.name}</CardTitle>
                  {selectedAccentSelection?.id === group.id && (
                    <CheckCircle className="h-4 w-4 text-primary" />
                  )}
                </div>
                <CardDescription>{group.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1 justify-center">
                  {group.examples.slice(0, 4).map((example, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {example}
                    </Badge>
                  ))}
                  {group.examples.length > 4 && (
                    <Badge variant="secondary" className="text-xs">
                      +{group.examples.length - 4}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Locale Dropdown - Card Style */}
      <div className="w-full max-w-md">
        <Card className="w-full rounded-2xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg">Specific Locale (Optional)</CardTitle>
            <CardDescription>Select for precise accent detection</CardDescription>
          </CardHeader>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <CardContent className="p-0">
                <div className="m-4 p-4 bg-muted/30 hover:bg-muted/50 rounded-xl cursor-pointer transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedLocale ? (
                      <>
                        <span>{selectedLocale.flag}</span>
                        <span className="font-medium">{selectedLocale.name}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Select Accent</span>
                    )}
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </div>
                {selectedLocale && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedLocale.particles.slice(0, 3).map((particle, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {particle}
                      </Badge>
                    ))}
                    {selectedLocale.particles.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{selectedLocale.particles.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
                </div>
              </CardContent>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 max-h-60 overflow-y-auto">
              {localeOptions.map((locale) => (
                <DropdownMenuItem
                  key={locale.id}
                  onClick={() => handleLocaleSelect(locale)}
                  className="flex flex-col items-start gap-2 p-3"
                >
                  <div className="flex items-center gap-2">
                    <span>{locale.flag}</span>
                    <span className="font-medium">{locale.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {locale.particles.slice(0, 3).map((particle, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {particle}
                      </Badge>
                    ))}
                    {locale.particles.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{locale.particles.length - 3}
                      </Badge>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </Card>
      </div>

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="w-full max-w-md">
          <Card className="border-accent/20 bg-accent/5 rounded-2xl">
            <CardContent className="text-center p-6">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
                <span className="text-lg font-medium text-accent">Processing Accent</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Generating accent-specific particle suggestions for {selectedAccentSelection?.name} accent...
              </p>
              <div className="mt-4 text-xs text-muted-foreground">
                <span className="text-sm">Analyzing audio with {selectedAccentSelection?.name} accent context</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Selection Summary - Minimalistic */}
      {selectedAccentSelection && !isProcessing && (
        <div className="text-center">
          <p className="text-lg font-medium">{selectedAccentSelection.name}</p>
          <p className="text-sm text-muted-foreground">
            {'locales' in selectedAccentSelection 
              ? `Covers: ${selectedAccentSelection.locales.join(', ')}`
              : `Locale: ${selectedAccentSelection.locale}`
            }
          </p>
          {cachedResults?.processedAccents?.has(selectedAccentSelection.id) && (
            <Badge variant="secondary" className="text-xs mt-2">
              ✓ Already Processed
            </Badge>
          )}
        </div>
      )}

      {/* Line Separator */}
      <div className="w-full border-t border-border"></div>

      {/* Process Button */}
      {selectedAccentSelection && (
        <div className="flex justify-center">
          <Button 
            onClick={handleContinue}
            disabled={isProcessing}
            size="lg"
            className="gap-2 px-8 py-3"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {cachedResults?.processedAccents?.has(selectedAccentSelection.id) && !hasFileChanged?.(audioFile)
                  ? "Continue with Processed Accent" 
                  : "Process Selected Accent"
                }
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      )}

      {/* Disabled State with Hint */}
      {!selectedAccentSelection && !isProcessing && (
        <div className="flex justify-center">
          <Button 
            disabled
            size="lg"
            className="gap-2 px-8 py-3"
          >
            Select Accent to Continue
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Helper Text */}
      <div className="text-center text-sm text-muted-foreground max-w-md mx-auto py-4">
        <p>
          Choose your accent or regional group for accurate particle detection. 
          This helps the AI better understand your speech patterns and local expressions.
        </p>
      </div>

    </div>
  );
}