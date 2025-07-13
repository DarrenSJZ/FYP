import { useState } from "react";
import { Moon, Sun, Minus, Plus, Settings, Terminal, Type, Mic, Headphones, Globe, Brain, Zap, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface RibbonProps {
  fontSize: number;
  onFontSizeChange: (size: number) => void;
}

export function Ribbon({
  fontSize,
  onFontSizeChange,
}: RibbonProps) {
  const { theme, setTheme } = useTheme();

  const incrementFontSize = () => {
    if (fontSize < 24) onFontSizeChange(fontSize + 1);
  };

  const decrementFontSize = () => {
    if (fontSize > 8) onFontSizeChange(fontSize - 1);
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };


  return (
    <div className="flex items-center gap-2 p-3 bg-card/95 backdrop-blur-sm border rounded-lg shadow-lg h-[52px]">
      {/* Theme Toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleTheme}
        className="gap-2"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        {theme === "dark" ? "Light" : "Dark"}
      </Button>

      <div className="h-6 w-px bg-border" />

      {/* Font Size Controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={decrementFontSize}
          disabled={fontSize <= 8}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="px-2 text-sm font-mono">{fontSize}px</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={incrementFontSize}
          disabled={fontSize >= 24}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="h-6 w-px bg-border" />

      {/* ASR Models Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <Mic className="h-4 w-4" />
            ASR Models
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="bg-popover border w-56">
          <DropdownMenuLabel>Individual Models</DropdownMenuLabel>
          <DropdownMenuItem>
            <Headphones className="h-4 w-4 mr-2" />
            Whisper (OpenAI)
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Zap className="h-4 w-4 mr-2" />
            Wav2Vec2 (Facebook)
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Moon className="h-4 w-4 mr-2" />
            Moonshine (Lightweight)
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Globe className="h-4 w-4 mr-2" />
            Mesolitica (Malaysian)
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Terminal className="h-4 w-4 mr-2" />
            VOSK (Offline)
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Type className="h-4 w-4 mr-2" />
            Allosaurus (Phonemes)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Multi-Model</DropdownMenuLabel>
          <DropdownMenuItem>
            <Settings className="h-4 w-4 mr-2" />
            Parallel Transcription
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="h-6 w-px bg-border" />

      {/* AI Analysis Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <Brain className="h-4 w-4" />
            AI Analysis
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="bg-popover border w-64">
          <DropdownMenuLabel>Advanced Features</DropdownMenuLabel>
          <DropdownMenuItem>
            <Brain className="h-4 w-4 mr-2" />
            AI Consensus (Gemini)
          </DropdownMenuItem>
          <DropdownMenuItem>
            <MessageSquare className="h-4 w-4 mr-2" />
            Particle Detection
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Globe className="h-4 w-4 mr-2" />
            Web Validation
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Cultural Markers</DropdownMenuLabel>
          <DropdownMenuItem>
            <Type className="h-4 w-4 mr-2" />
            Southeast Asian (la, lor, leh)
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Type className="h-4 w-4 mr-2" />
            British (innit, mate, cheers)
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Type className="h-4 w-4 mr-2" />
            Indian (na, yaar, bhai)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Debug & Research</DropdownMenuLabel>
          <DropdownMenuItem>
            <Terminal className="h-4 w-4 mr-2" />
            Debug Mode
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Zap className="h-4 w-4 mr-2" />
            Performance Analysis
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}