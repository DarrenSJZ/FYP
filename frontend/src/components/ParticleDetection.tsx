import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Brain, Zap, Target, CheckCircle2, GripVertical, RotateCcw } from "lucide-react";
import { StageNavigation } from "./StageNavigation";
import { StageProgressBar } from "./StageProgressBar";
import type { WorkflowStage } from "@/pages/Index";
import type { AccentOption } from "./AccentSelection";

export interface PotentialParticle {
  confidence: number;
  character_position: number;
  particle: string;
  word_index: number;
  ipa: string;
  region: string;
}

export interface ParticleDetectionData {
  status: string;
  primary: string;
  alternatives: {
    whisper: string;
    wav2vec: string;
    moonshine: string;
    mesolitica: string;
    vosk: string;
  };
  potential_particles: PotentialParticle[];
  metadata: {
    confidence: number;
    processing_time: number;
    models_used: number;
  };
}

interface ParticleDetectionProps {
  particleData: ParticleDetectionData;
  selectedAccent: AccentOption;
  onParticlesSelected: (selectedParticles: PotentialParticle[], llmSuggestion?: string) => void;
  onBack: () => void;
  onNext?: () => void;
  completedStages: Set<WorkflowStage>;
  onStageClick?: (stage: WorkflowStage) => void;
}

interface PlacedParticle {
  particle: PotentialParticle;
  position: number; // Position between words (0 = before first word, 1 = after first word, etc.)
}

// Discourse particles by region (matching backend)
const DISCOURSE_PARTICLES = {
  "southeast_asian": ["la", "lor", "leh", "meh", "sia", "wat", "lah", "aiya", "wah", "aiyo"],
  "british": ["innit", "right", "mate", "cheers", "bloody", "blimey"],
  "indian": ["na", "yaar", "bhai", "re", "hai", "kya", "bas", "arre"],
  "universal": ["ah", "um", "er", "uh", "hmm", "oh", "eh", "ya", "yeah", "okay"]
};

export function ParticleDetection({ 
  particleData, 
  selectedAccent, 
  onParticlesSelected, 
  onBack, 
  onNext, 
  completedStages, 
  onStageClick 
}: ParticleDetectionProps) {
  const [placedParticles, setPlacedParticles] = useState<PlacedParticle[]>([]);
  const [draggedParticle, setDraggedParticle] = useState<PotentialParticle | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<number | null>(null);
  const [draggedFromPlacement, setDraggedFromPlacement] = useState<boolean>(false);
  const [nearbyPositions, setNearbyPositions] = useState<number[]>([]);
  // Split transcription into words and punctuation
  const words = particleData.primary.trim().split(/(\s+|[.,!?;:])/).filter(token => token.trim() !== '');

  // Get relevant particles for the selected accent
  const getRelevantParticles = () => {
    const accentKey = selectedAccent.discourseParticles || "universal";
    return DISCOURSE_PARTICLES[accentKey as keyof typeof DISCOURSE_PARTICLES] || DISCOURSE_PARTICLES.universal;
  };

  const relevantParticles = getRelevantParticles();

  // Filter potential particles to only show those relevant to the selected accent
  const availableParticles = particleData.potential_particles.filter(
    particle => relevantParticles.includes(particle.particle) || particle.region === "universal"
  );

  // Get unused particles (not yet placed)
  const unusedParticles = availableParticles.filter(
    particle => !placedParticles.some(placed => placed.particle.particle === particle.particle)
  );

  const handleDragStart = (e: React.DragEvent, particle: PotentialParticle, fromPlacement: boolean = false) => {
    setDraggedParticle(particle);
    setDraggedFromPlacement(fromPlacement);
    e.dataTransfer.effectAllowed = "move";
    
    // Show all drop zones when dragging starts
    setNearbyPositions([...Array(words.length + 1).keys()]);
  };

  const handleDragEnd = () => {
    // If particle was dragged from placement but not dropped anywhere, remove it
    if (draggedFromPlacement && draggedParticle) {
      setPlacedParticles(prev => prev.filter(
        placed => placed.particle.particle !== draggedParticle.particle
      ));
    }
    setDraggedParticle(null);
    setDragOverPosition(null);
    setDraggedFromPlacement(false);
    setNearbyPositions([]);
  };

  const handleDragOver = (e: React.DragEvent, position: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverPosition(position);
  };

  const handleDragLeave = () => {
    setDragOverPosition(null);
  };

  const handleDrop = (e: React.DragEvent, position: number) => {
    e.preventDefault();
    if (draggedParticle) {
      // Remove any existing placement of this particle
      const updatedPlacements = placedParticles.filter(
        placed => placed.particle.particle !== draggedParticle.particle
      );
      
      // Add new placement
      const newPlacement: PlacedParticle = {
        particle: draggedParticle,
        position: position
      };
      
      setPlacedParticles([...updatedPlacements, newPlacement]);
    }
    setDraggedParticle(null);
    setDragOverPosition(null);
    setDraggedFromPlacement(false);
    setNearbyPositions([]);
  };

  const handleRemoveParticle = (particleToRemove: PotentialParticle) => {
    setPlacedParticles(prev => prev.filter(placed => placed.particle.particle !== particleToRemove.particle));
  };

  const reconstructSentence = () => {
    let result: string[] = [];
    
    // Sort placed particles by position
    const sortedPlacements = [...placedParticles].sort((a, b) => a.position - b.position);
    
    // Build sentence with particles
    for (let i = 0; i <= words.length; i++) {
      // Add particles at this position
      const particlesAtPosition = sortedPlacements.filter(p => p.position === i);
      particlesAtPosition.forEach(p => {
        result.push(p.particle.particle);
      });
      
      // Add word if not at the end
      if (i < words.length) {
        result.push(words[i]);
      }
    }
    
    // Join with spaces, but handle punctuation correctly
    return result.reduce((acc, current, index) => {
      if (index === 0) return current;
      
      // Check if current token is punctuation
      const isPunctuation = /^[.,!?;:]+$/.test(current);
      
      if (isPunctuation) {
        // No space before punctuation
        return acc + current;
      } else {
        // Space before regular words and particles
        return acc + " " + current;
      }
    }, "");
  };

  const handleContinue = () => {
    const selectedParticles = placedParticles.map(p => p.particle);
    onParticlesSelected(selectedParticles, reconstructSentence());
  };

  const handleReset = () => {
    setPlacedParticles([]);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 pt-12 pb-12 flex flex-col items-center justify-center">
        {/* Stage Header */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Particle Placement</h2>
          <p className="text-muted-foreground">
            Drag discourse particles into the sentence where you think they belong
          </p>
        </div>

      {/* Progress Bar */}
      <StageProgressBar
        currentStage="particle-placement"
        completedStages={completedStages}
        onStageClick={onStageClick}
      />

      {/* Navigation */}
      <div className="w-full">
        <StageNavigation
          onBack={onBack}
          onNext={handleContinue}
          nextText="Next"
          nextDisabled={placedParticles.length === 0}
        />
      </div>

      {/* Original Sentence Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-medium text-muted-foreground">
            {placedParticles.length > 0 ? "Modified Sentence" : "Original Sentence"}
          </h3>
        </div>
        <div className="w-full max-w-4xl">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <p className="text-lg leading-relaxed font-medium text-foreground">
              {placedParticles.length > 0 ? reconstructSentence() : particleData.primary}
            </p>
          </div>
        </div>
      </div>

      {/* Drag and Drop Interface */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Drag Particles into Position
          </CardTitle>
          <CardDescription>
            Drag the particles below into the sentence where you think they belong
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Sentence with drop zones */}
          <div className="bg-muted rounded-lg p-6 mb-6">
            <div className="flex flex-wrap items-center gap-2">
              {/* Drop zone before first word */}
              <div
                data-drop-zone="0"
                className="flex items-center gap-2 flex-wrap"
              >
                {/* Show particles placed at position 0 */}
                {placedParticles
                  .filter(p => p.position === 0)
                  .map((placed, index) => (
                    <div
                      key={index}
                      draggable
                      onDragStart={(e) => handleDragStart(e, placed.particle, true)}
                      onDragEnd={handleDragEnd}
                      className="inline-flex items-center gap-1 bg-yellow-200 dark:bg-yellow-800 px-2 py-1 rounded-md text-sm font-medium cursor-move hover:bg-yellow-300 dark:hover:bg-yellow-700"
                      onClick={() => handleRemoveParticle(placed.particle)}
                      title="Click to remove or drag to move"
                    >
                      {placed.particle.particle}
                      <Badge variant="secondary" className="text-xs ml-1">
                        {Math.round(placed.particle.confidence * 100)}%
                      </Badge>
                    </div>
                  ))}
                
                {/* Drop zone - only show when dragging and no particles placed here */}
                {draggedParticle && placedParticles.filter(p => p.position === 0).length === 0 && (
                  <div
                    className={`min-w-8 h-12 rounded-lg border-2 border-dashed transition-all duration-200 ${
                      dragOverPosition === 0 
                        ? "border-primary bg-primary/10" 
                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                    }`}
                    onDragOver={(e) => handleDragOver(e, 0)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, 0)}
                  />
                )}
              </div>

              {/* Words and drop zones */}
              {words.map((word, index) => {
                const isPunctuation = /^[.,!?;:]+$/.test(word);
                return (
                  <div key={index} className="flex items-center gap-2">
                    {/* Word bubble */}
                    <div className={`bg-background border-2 border-border rounded-lg shadow-sm ${
                      isPunctuation ? 'px-2 py-2' : 'px-4 py-2'
                    }`}>
                      <span className="font-medium">{word}</span>
                    </div>
                  
                  {/* Drop zone after this word */}
                  <div
                    data-drop-zone={index + 1}
                    className="flex items-center gap-2 flex-wrap"
                  >
                    {/* Show particles placed at this position */}
                    {placedParticles
                      .filter(p => p.position === index + 1)
                      .map((placed, pIndex) => (
                        <div
                          key={pIndex}
                          draggable
                          onDragStart={(e) => handleDragStart(e, placed.particle, true)}
                          onDragEnd={handleDragEnd}
                          className="inline-flex items-center gap-1 bg-yellow-200 dark:bg-yellow-800 px-2 py-1 rounded-md text-sm font-medium cursor-move hover:bg-yellow-300 dark:hover:bg-yellow-700"
                          onClick={() => handleRemoveParticle(placed.particle)}
                          title="Click to remove or drag to move"
                        >
                          {placed.particle.particle}
                          <Badge variant="secondary" className="text-xs ml-1">
                            {Math.round(placed.particle.confidence * 100)}%
                          </Badge>
                        </div>
                      ))}
                    
                    {/* Drop zone - only show when dragging and no particles placed here */}
                    {draggedParticle && placedParticles.filter(p => p.position === index + 1).length === 0 && (
                      <div
                        className={`min-w-8 h-12 rounded-lg border-2 border-dashed transition-all duration-200 ${
                          dragOverPosition === index + 1 
                            ? "border-primary bg-primary/10" 
                            : "border-muted-foreground/30 hover:border-muted-foreground/50"
                        }`}
                        onDragOver={(e) => handleDragOver(e, index + 1)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index + 1)}
                      />
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          {/* Available particles to drag */}
          <div className="space-y-4">
            
            {/* Line separator */}
            <div className="border-t border-border my-4"></div>
            
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold">AI Detected Particles</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
            
            {unusedParticles.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {unusedParticles.map((particle, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={(e) => handleDragStart(e, particle)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg cursor-move hover:bg-primary/90 transition-colors shadow-sm border ${
                      draggedParticle?.particle === particle.particle ? "opacity-50" : ""
                    }`}
                  >
                    <GripVertical className="h-4 w-4" />
                    <span className="font-medium">"{particle.particle}"</span>
                    <Badge variant="secondary" className="text-xs bg-primary-foreground/20">
                      {particle.ipa}
                    </Badge>
                    <Badge variant="secondary" className="text-xs bg-primary-foreground/20">
                      {Math.round(particle.confidence * 100)}%
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                <p>All particles have been placed!</p>
              </div>
            )}
            
            {/* Line separator */}
            <div className="border-t border-border my-4"></div>
            
            {/* Accent Info */}
            <div className="mb-4">
              <h4 className="font-semibold text-base mb-3">{selectedAccent.name} Accent Particles</h4>
              <div className="flex flex-wrap gap-2">
                {relevantParticles.map((particle, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {particle}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>



      {/* Continue Button */}
      <div className="flex justify-center pt-4">
        <Button
          onClick={handleContinue}
          disabled={placedParticles.length === 0}
          size="lg"
          className="gap-2 px-8"
        >
          Complete Particle Placement
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Helper Text */}
      <div className="text-center text-sm text-muted-foreground">
        <p>
          Drag particles into the dashed boxes between words. Click or drag placed particles to remove them.
        </p>
      </div>
    </div>
  );
}