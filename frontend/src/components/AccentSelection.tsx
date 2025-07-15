import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, ArrowRight, CheckCircle, ChevronDown } from "lucide-react";
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
    id: "mixed",
    name: "Mixed/International",
    description: "Mixed accents or international English",
    examples: ["varied", "mixed", "neutral", "international"],
    region: "Global",
    discourseParticles: "mixed"
  }
];

export function AccentSelection({ transcriptionText, onAccentSelected, onBack, onNext, completedStages, onStageClick }: AccentSelectionProps) {
  const [selectedAccent, setSelectedAccent] = useState<AccentOption | null>(null);

  const handleAccentSelect = (accent: AccentOption) => {
    setSelectedAccent(accent);
  };

  const handleContinue = () => {
    if (selectedAccent) {
      onAccentSelected(selectedAccent);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 pt-12 pb-12">
      {/* Stage Header - At the tippity top */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Accent Selection</h2>
        <p className="text-muted-foreground">
          Based on the transcription, which accent do you think the speaker has?
        </p>
      </div>

      {/* Progress Bar - Second */}
      <StageProgressBar
        currentStage="accent"
        completedStages={completedStages}
        onStageClick={onStageClick}
      />

      {/* Navigation - Third */}
      <div className="w-full">
        <StageNavigation
          onBack={onBack}
          onNext={handleContinue}
          nextText="Next"
          nextDisabled={!selectedAccent}
        />
      </div>

      {/* Transcription Preview - Minimal */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Transcription</h3>
        </div>
        <div className="bg-muted rounded-lg p-4 max-h-32 overflow-y-auto">
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
              className={`cursor-pointer transition-all duration-200 p-4 rounded-lg border-2 ${
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
          <div className="cursor-pointer transition-all duration-200 p-4 rounded-lg border-2 border-border hover:border-primary/50 hover:bg-muted/30">
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

      {/* Continue Button */}
      <div className="flex justify-center pt-4">
        <Button
          onClick={handleContinue}
          disabled={!selectedAccent}
          size="lg"
          className="gap-2 px-8"
        >
          Continue to Particle Placement
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