import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Upload, FileAudio, X, Play, Pause, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";

interface AudioUploadProps {
  onTranscriptionComplete: (transcription: string, file?: File, consensusData?: any) => void;
  selectedModel?: string;
  selectedAnalysis?: string;
  onFileRemoved?: () => void;
  currentFile?: File;
  hasProcessedFile?: boolean;
}

export function AudioUpload({ 
  onTranscriptionComplete, 
  selectedModel = "parallel",
  selectedAnalysis = "basic",
  onFileRemoved,
  currentFile,
  hasProcessedFile = false
}: AudioUploadProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const { toast } = useToast();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Restore file state when component mounts with existing file
  useEffect(() => {
    if (currentFile && !uploadedFile) {
      setUploadedFile(currentFile);
      const url = URL.createObjectURL(currentFile);
      setAudioUrl(url);
    }
  }, [currentFile, uploadedFile]);


  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      setUploadedFile(file);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
      setUploadedFile(file);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const removeFile = () => {
    setUploadedFile(null);
    setAudioUrl(null);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    // Clear session storage when file is removed
    sessionStorage.removeItem('particleData');
    sessionStorage.removeItem('uploadedFileName');
    sessionStorage.removeItem('uploadedFileBlob');
    // Notify parent component to clear cache
    onFileRemoved?.();
  };

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const startTranscription = async () => {
    if (!uploadedFile) return;
    
    // If this file has already been processed, skip transcription and use cached data
    if (hasProcessedFile) {
      const storedParticleData = sessionStorage.getItem('particleData');
      if (storedParticleData) {
        try {
          const result = JSON.parse(storedParticleData);
          const primaryTranscription = result.primary || 'No transcription available';
          onTranscriptionComplete(primaryTranscription, uploadedFile, result);
          return;
        } catch (error) {
          console.error('Failed to parse stored data:', error);
        }
      }
    }
    
    setIsTranscribing(true);
    setTranscriptionProgress(0);
    
    try {
      const bucketName = "user-contributions";
      const filePath = `${uploadedFile.name}`; // Use original filename as path

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, uploadedFile, {
          cacheControl: '3600',
          upsert: true, // Overwrite if file with same name exists
        });

      if (uploadError) {
        throw new Error(`Supabase Storage Upload Error: ${uploadError.message}`);
      }

      // Get public URL of the uploaded file
      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      if (!publicUrlData || !publicUrlData.publicUrl) {
        throw new Error("Could not get public URL for the uploaded file.");
      }

      const audioPublicUrl = publicUrlData.publicUrl;

      const formData = new FormData();
      formData.append('file', uploadedFile); // Send file directly to orchestrator
      formData.append('context', practiceMode ? 'Practice mode analysis' : 'Speech recognition analysis');
      
      // Add ground truth for practice mode
      if (practiceMode && groundTruth) {
        formData.append('ground_truth', groundTruth);
      }
      
      // Progress simulation with realistic stages for consensus only
      const progressStages = [
        { progress: 15, message: 'Initializing ASR models...' },
        { progress: 40, message: 'Running parallel transcription...' },
        { progress: 70, message: 'Establishing consensus...' },
        { progress: 90, message: 'Validating with web search...' }
      ];
      
      let currentStage = 0;
      const progressInterval = setInterval(() => {
        if (currentStage < progressStages.length) {
          setTranscriptionProgress(progressStages[currentStage].progress);
          currentStage++;
        }
      }, 2000); // 2 second intervals for realistic timing
      
      // Use the new consensus endpoint (stage 1)
      const response = await fetch('http://localhost:8000/transcribe-consensus', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      clearInterval(progressInterval);
      setTranscriptionProgress(100);
      
      // Extract primary transcription for the validation stage
      const primaryTranscription = result.primary || 'No transcription available';
      
      // Store the full result for later use in particle detection
      if (result.status === 'success') {
        // Store particle data in session storage for later use
        sessionStorage.setItem('particleData', JSON.stringify(result));
        // Also store the audio file name for potential reuse
        sessionStorage.setItem('uploadedFileName', uploadedFile.name);
        // Store the audio file as a blob URL for API calls
        const reader = new FileReader();
        reader.onloadend = () => {
          sessionStorage.setItem('uploadedFileBlob', reader.result as string);
        };
        reader.readAsDataURL(uploadedFile);
      }
      
      onTranscriptionComplete(primaryTranscription, uploadedFile || undefined, result);
      
    } catch (error) {
      console.error('Transcription failed:', error);
      toast({
        title: "Transcription Failed",
        description: error.message || "An unknown error occurred. Please check the console for more details.",
        variant: "destructive",
      });
      onTranscriptionComplete('Transcription failed. Please check your backend connection and try again.');
    } finally {
      setIsTranscribing(false);
      setTranscriptionProgress(0);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };


  return (
    <div className="w-full space-y-4">
      {/* Upload Area */}
      {!uploadedFile ? (
        <div
          className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer bg-muted/50"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-muted">
              <Upload className="h-8 w-8 text-[hsl(var(--chip-brown))]" />
            </div>
            <div>
              <p className="text-lg font-medium">Upload Audio File</p>
              <p className="text-sm text-muted-foreground">
                Drag and drop your audio file here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Supports: MP3, WAV, M4A, FLAC, OGG
              </p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      ) : (
        /* File Preview */
        <div className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileAudio className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate max-w-64">{uploadedFile.name}</p>
                  {hasProcessedFile && (
                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Processed
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(uploadedFile.size)}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={removeFile}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Audio Player */}
          {audioUrl && (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={togglePlayback}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <audio
                ref={audioRef}
                src={audioUrl}
                onEnded={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                className="hidden"
              />
              <div className="flex-1 flex items-center gap-2 text-sm text-muted-foreground">
                <span>Preview Audio</span>
              </div>
            </div>
          )}


          {/* Transcription Progress */}
          {isTranscribing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Transcribing audio...</span>
              </div>
              <Progress value={transcriptionProgress} className="w-full" />
            </div>
          )}

          {/* Debug Info */}
          {/* {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
              Debug: hasProcessedFile={hasProcessedFile ? 'true' : 'false'}, 
              currentFile={currentFile ? currentFile.name : 'none'},
              uploadedFile={uploadedFile ? uploadedFile.name : 'none'}
            </div>
          )} */}

          {/* Transcribe/Continue Button */}
          {hasProcessedFile ? (
            <div className="space-y-3">
              <Button 
                onClick={() => {
                  // Use cached data and proceed
                  const storedParticleData = sessionStorage.getItem('particleData');
                  if (storedParticleData) {
                    try {
                      const result = JSON.parse(storedParticleData);
                      const primaryTranscription = result.primary || 'No transcription available';
                      onTranscriptionComplete(primaryTranscription, uploadedFile, result);
                    } catch (error) {
                      console.error('Failed to parse stored data:', error);
                      // Fallback to API call
                      startTranscription();
                    }
                  } else {
                    // No cached data, fall back to API call
                    startTranscription();
                  }
                }}
                disabled={isTranscribing}
                className="w-full"
              >
                Continue with This File
              </Button>
              
              <Button 
                onClick={removeFile}
                disabled={isTranscribing}
                variant="secondary"
                className="w-full"
              >
                Select Another File
              </Button>
            </div>
          ) : (
            <Button 
              onClick={startTranscription}
              disabled={isTranscribing}
              className="w-full"
            >
              {isTranscribing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Transcribing...
                </>
              ) : (
                'Start Transcription'
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}