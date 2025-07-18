import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Brain, User, CheckCircle2, Sparkles, Download } from "lucide-react";
import { StageNavigation } from "./StageNavigation";
import { StageProgressBar } from "./StageProgressBar";
import type { WorkflowStage } from "@/pages/Index";
import type { AccentOption } from "./AccentSelection";
import type { PotentialParticle } from "./ParticleDetection";

interface TranscriptionComparisonProps {
  originalTranscription: string;
  userTranscription: string;
  selectedAccent: AccentOption;
  selectedParticles: PotentialParticle[];
  onTranscriptionSelected: (selection: 'ai' | 'user', finalTranscription: string) => void;
  onBack: () => void;
  completedStages: Set<WorkflowStage>;
  onStageClick?: (stage: WorkflowStage) => void;
  aiGeneratedTranscription?: string; // AI-generated transcription from Step 5
}

export function TranscriptionComparison({
  originalTranscription,
  userTranscription,
  selectedAccent,
  selectedParticles,
  onTranscriptionSelected,
  onBack,
  completedStages,
  onStageClick,
  aiGeneratedTranscription
}: TranscriptionComparisonProps) {
  const [selectedOption, setSelectedOption] = useState<'ai' | 'user' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasAiTranscription = aiGeneratedTranscription && aiGeneratedTranscription.trim().length > 0;
  const isExactMatch = hasAiTranscription && aiGeneratedTranscription === userTranscription;

  // Automatically select AI if exact match
  useEffect(() => {
    if (isExactMatch) {
      setSelectedOption('ai');
    }
  }, [isExactMatch]);

  const handleOptionSelect = (option: 'ai' | 'user') => {
    setSelectedOption(option);
  };

  const handleSubmit = async () => {
    if (!selectedOption) return;
    
    setIsSubmitting(true);
    
    try {
      let finalTranscription = selectedOption === 'ai' ? aiGeneratedTranscription : userTranscription;
      
      // If user made manual particle selections, send them back to backend for final transcription
      if (selectedOption === 'user' && selectedParticles.length > 0) {
        const storedFileName = sessionStorage.getItem('uploadedFileName');
        if (storedFileName) {
          try {
            // Prepare human particle data
            const humanParticleData = {
              particles: selectedParticles,
              positions: {}, // Could be enhanced to include positions
              accent: selectedAccent.discourseParticles
            };
            
            // Make second call to backend with human particles
            const formData = new FormData();
            // Note: We'd need to store the actual file, not just the name
            // For now, we'll use the stored particle data and human selections
            formData.append('human_particles', JSON.stringify(humanParticleData));
            formData.append('context', 'Human particle integration');
            
            console.log('Sending human particles to backend:', humanParticleData);
            
            // TODO: Implement actual second API call when we have the audio file stored
            // const response = await fetch('http://localhost:8000/transcribe-with-gemini', {
            //   method: 'POST',
            //   body: formData,
            // });
            // const result = await response.json();
            // finalTranscription = result.primary || finalTranscription;
            
          } catch (error) {
            console.error('Failed to send human particles to backend:', error);
          }
        }
      }
      
      // Simulate database submission
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      onTranscriptionSelected(selectedOption, finalTranscription);
    } catch (error) {
      console.error('Error submitting transcription:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 pt-20 mb-8 flex flex-col items-center justify-center">
      {/* Progress Bar */}
      <StageProgressBar
        currentStage="comparison"
        completedStages={completedStages}
        onStageClick={onStageClick}
      />

      {/* Stage Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Transcription Comparison</h2>
        <p className="text-muted-foreground">
          {hasAiTranscription ? 'Choose between the AI-generated transcript and your manual placement' : 'Choose the best transcription to save to the database'}
        </p>
      </div>

      {/* Navigation */}
      <div className="w-full">
        <StageNavigation
          onBack={onBack}
          onNext={handleSubmit}
          nextText="Finish"
          nextDisabled={!selectedOption || isSubmitting}
        />
      </div>

      {/* Conditional Rendering for Comparison Options */}
      {isExactMatch ? (
        <div
          className={`cursor-pointer transition-all duration-200 p-6 rounded-2xl border-2 w-full max-w-6xl ${
            selectedOption === 'ai' 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
          }`}
          onClick={() => handleOptionSelect('ai')}
        >
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-semibold text-primary">Perfect Match!</span>
            {selectedOption === 'ai' && <CheckCircle2 className="h-5 w-5 text-primary ml-auto" />}
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm leading-relaxed">
              Your manual placement perfectly matches the AI-generated transcription.
            </p>
            <p className="text-sm leading-relaxed mt-2 font-medium">
              {aiGeneratedTranscription}
            </p>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-6xl flex flex-col md:flex-row gap-6 items-stretch">
          {/* AI Generated Option (Step 5) */}
          {hasAiTranscription && (
            <div
              className={`flex-1 cursor-pointer transition-all duration-200 p-6 rounded-2xl border-2 ${
                selectedOption === 'ai' 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => handleOptionSelect('ai')}
            >
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-semibold text-primary">AI Generated Transcript</span>
                {selectedOption === 'ai' && <CheckCircle2 className="h-5 w-5 text-primary ml-auto" />}
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-sm leading-relaxed">
                  {aiGeneratedTranscription}
                </p>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Final AI integration of all pipeline steps
              </div>
            </div>
          )}

          {/* OR Separator */}
          <div className="flex items-center justify-center md:px-4">
            <div className="bg-background px-3 py-1 rounded-full border border-border shadow-sm">
              <span className="text-sm font-medium text-muted-foreground">OR</span>
            </div>
          </div>

          {/* User Option */}
          <div
            className={`flex-1 cursor-pointer transition-all duration-200 p-6 rounded-2xl border-2 ${
              selectedOption === 'user' 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50'
            }`}
            onClick={() => handleOptionSelect('user')}
          >
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5" />
              <span className="font-semibold">Your Manual Placement</span>
              {selectedOption === 'user' && <CheckCircle2 className="h-5 w-5 text-primary ml-auto" />}
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm leading-relaxed">
                {userTranscription}
              </p>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Manual particle placement
            </div>
          </div>
        </div>
      )}

      

      <div className="w-full border-t border-border my-4"></div>

      {/* Submit Button */}
      <div className="flex justify-center pt-4">
        <Button
          onClick={handleSubmit}
          disabled={!selectedOption || isSubmitting}
          size="lg"
          className="gap-2 px-8"
        >
          {isSubmitting ? "Submitting..." : "Submit"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Helper Text */}
      <div className="text-center text-sm text-muted-foreground py-4">
        <p>
          {hasAiTranscription ? 'The AI Generated Transcript represents the final integration of all pipeline steps.' : 'Select the transcription that best represents the audio.'}
        </p>
      </div>
    </div>
  );
}