import { useState } from "react";
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
  llmTranscription: string;
  userTranscription: string;
  selectedAccent: AccentOption;
  selectedParticles: PotentialParticle[];
  onTranscriptionSelected: (selection: 'llm' | 'user', finalTranscription: string) => void;
  onBack: () => void;
  completedStages: Set<WorkflowStage>;
  onStageClick?: (stage: WorkflowStage) => void;
}

export function TranscriptionComparison({
  originalTranscription,
  llmTranscription,
  userTranscription,
  selectedAccent,
  selectedParticles,
  onTranscriptionSelected,
  onBack,
  completedStages,
  onStageClick
}: TranscriptionComparisonProps) {
  const [selectedOption, setSelectedOption] = useState<'llm' | 'user' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOptionSelect = (option: 'llm' | 'user') => {
    setSelectedOption(option);
  };

  const handleSubmit = async () => {
    if (!selectedOption) return;
    
    setIsSubmitting(true);
    
    try {
      const finalTranscription = selectedOption === 'llm' ? llmTranscription : userTranscription;
      
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
    <div className="w-full max-w-6xl mx-auto space-y-8 pt-12 pb-12 flex flex-col items-center justify-center">
      {/* Stage Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Transcription Comparison</h2>
        <p className="text-muted-foreground">
          Choose the best transcription to save to the database
        </p>
      </div>

      {/* Progress Bar */}
      <StageProgressBar
        currentStage="comparison"
        completedStages={completedStages}
        onStageClick={onStageClick}
      />

      {/* Navigation */}
      <div className="w-full">
        <StageNavigation
          onBack={onBack}
          onNext={handleSubmit}
          nextText={isSubmitting ? "Submitting..." : "Next"}
          nextDisabled={!selectedOption || isSubmitting}
        />
      </div>

      {/* Comparison Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LLM Option */}
        <div
          className={`cursor-pointer transition-all duration-200 p-6 rounded-2xl border-2 ${
            selectedOption === 'llm' 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
          }`}
          onClick={() => handleOptionSelect('llm')}
        >
          <div className="flex items-center gap-2 mb-4">
            <Brain className="h-5 w-5" />
            <span className="font-semibold">AI-Generated</span>
            {selectedOption === 'llm' && <CheckCircle2 className="h-5 w-5 text-primary ml-auto" />}
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm leading-relaxed">
              {llmTranscription}
            </p>
          </div>
        </div>

        {/* User Option */}
        <div
          className={`cursor-pointer transition-all duration-200 p-6 rounded-2xl border-2 ${
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
        </div>
      </div>

      {/* Helper Text */}
      <div className="text-center text-sm text-muted-foreground">
        <p>
          Select the transcription that best represents the audio.
        </p>
      </div>
    </div>
  );
}