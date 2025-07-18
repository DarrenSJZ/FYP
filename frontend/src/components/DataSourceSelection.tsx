import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shuffle, Upload, Zap, FileAudio, Users, Globe } from "lucide-react";
import { StageNavigation } from "./StageNavigation";

interface DataSourceSelectionProps {
  onModeSelect: (mode: 'practice' | 'upload') => void;
  onBack?: () => void;
}

export function DataSourceSelection({ onModeSelect, onBack }: DataSourceSelectionProps) {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 py-12">
      {/* Header */}
      <div className="text-center space-y-4 flex flex-col items-center">
        <div className="flex justify-center">
          <Badge variant="outline" className="px-4 py-2 text-sm">
            Choose Your Mode
          </Badge>
        </div>
        <h1 className="text-3xl font-bold">How would you like to practice?</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Choose between practicing with our curated dataset or uploading your own audio files
        </p>
      </div>

      {/* Mode Selection Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Practice Mode */}
        <Card className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 border-2 hover:border-primary/50">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Shuffle className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Practice Mode</CardTitle>
            <CardDescription className="text-base">
              Get randomly assigned audio from our curated dataset
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" style={{color: 'hsl(var(--chip-brown))'}} />
                <span className="text-sm">Quick start - no upload needed</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" style={{color: 'hsl(var(--chip-brown))'}} />
                <span className="text-sm">Curated dataset with variety</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" style={{color: 'hsl(var(--chip-brown))'}} />
                <span className="text-sm">Multiple accents and languages</span>
              </div>
            </div>
            
            <Button 
              onClick={() => onModeSelect('practice')}
              className="w-full mt-4 bg-primary hover:bg-primary/90"
              size="lg"
            >
              Start Practice Session
            </Button>
            
            <div className="text-center">
              <Badge variant="outline" className="text-xs">
                Like Monkeytype for voice
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Upload Mode */}
        <Card className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 border-2 hover:border-primary/50">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mb-4">
              <Upload className="h-8 w-8 text-[hsl(var(--chip-brown))]" />
            </div>
            <CardTitle className="text-2xl">Upload Your Own</CardTitle>
            <CardDescription className="text-base">
              Upload your own audio files for transcription practice
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileAudio className="h-4 w-4" style={{color: 'hsl(var(--chip-brown))'}} />
                <span className="text-sm">Use your own audio files</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" style={{color: 'hsl(var(--chip-brown))'}} />
                <span className="text-sm">Personalized practice sessions</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" style={{color: 'hsl(var(--chip-brown))'}} />
                <span className="text-sm">Advanced AI transcription models</span>
              </div>
            </div>
            
            <Button 
              onClick={() => onModeSelect('upload')}
              variant="secondary"
              className="w-full mt-4"
              size="lg"
            >
              Upload Audio File
            </Button>
            
            <div className="text-center">
              <Badge variant="outline" className="text-xs">
                MP3, WAV, M4A supported
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation */}
      <StageNavigation
        showBack={false}
        showNext={false}
      />

      {/* Info Section */}
      <div className="text-center space-y-2 pt-4">
        <p className="text-sm text-muted-foreground">
          Both modes will take you through the same 3-stage validation process
        </p>
        <div className="flex justify-center gap-4 text-xs text-muted-foreground">
          <span>1. Transcription Validation</span>
          <span>•</span>
          <span>2. Accent Selection</span>
          <span>•</span>
          <span>3. Particle Placement</span>
        </div>
      </div>

    </div>
  );
}