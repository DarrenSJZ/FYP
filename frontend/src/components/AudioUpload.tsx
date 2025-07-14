import { useState, useRef } from "react";
import { Upload, FileAudio, X, Play, Pause, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface AudioUploadProps {
  onTranscriptionComplete: (transcription: string, file?: File) => void;
  selectedModel?: string;
  selectedAnalysis?: string;
}

export function AudioUpload({ 
  onTranscriptionComplete, 
  selectedModel = "parallel",
  selectedAnalysis = "basic" 
}: AudioUploadProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

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
    
    setIsTranscribing(true);
    setTranscriptionProgress(0);
    
    try {
      const formData = new FormData();
      formData.append('audio', uploadedFile);
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setTranscriptionProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      // Determine endpoint based on selected options
      let endpoint = 'http://localhost:8000/transcribe';
      if (selectedAnalysis === 'ai-consensus') {
        endpoint = 'http://localhost:8000/transcribe-with-gemini';
      } else if (selectedAnalysis === 'debug') {
        endpoint = 'http://localhost:8000/transcribe-with-gemini/debug';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      clearInterval(progressInterval);
      setTranscriptionProgress(100);
      
      // Extract transcription based on response type
      let transcription = '';
      if (result.final_transcription) {
        transcription = result.final_transcription;
      } else if (result.transcriptions) {
        // Multiple model results - combine or use consensus
        transcription = Object.values(result.transcriptions).join('\n\n');
      } else if (result.transcription) {
        transcription = result.transcription;
      }
      
      onTranscriptionComplete(transcription, uploadedFile || undefined);
      
    } catch (error) {
      console.error('Transcription failed:', error);
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
          className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
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
                <p className="font-medium truncate max-w-64">{uploadedFile.name}</p>
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

          {/* Transcribe Button */}
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
        </div>
      )}
    </div>
  );
}