import { useState } from "react";
import { Moon, Sun, Minus, Plus, Settings, Terminal, Type, Mic, Headphones, Globe, Brain, Zap, MessageSquare, Highlighter, Bold, Italic, Underline } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  fontFamily?: string;
  onFontFamilyChange?: (family: string) => void;
  selectedHighlighter?: string | null;
  onHighlighterChange?: (color: string | null) => void;
  activeFormatting?: Set<string>;
  onFormattingChange?: (formatting: Set<string>) => void;
}

export function Ribbon({
  fontSize,
  onFontSizeChange,
  fontFamily = "Monaco, Menlo, 'Ubuntu Mono', monospace",
  onFontFamilyChange,
  selectedHighlighter = null,
  onHighlighterChange,
  activeFormatting = new Set(),
  onFormattingChange,
}: RibbonProps) {

  const incrementFontSize = () => {
    if (fontSize < 24) onFontSizeChange(fontSize + 1);
  };

  const decrementFontSize = () => {
    if (fontSize > 8) onFontSizeChange(fontSize - 1);
  };

  const highlightColors = [
    { name: "Yellow", value: "bg-yellow-200", class: "bg-yellow-200" },
    { name: "Green", value: "bg-green-200", class: "bg-green-200" },
    { name: "Blue", value: "bg-blue-200", class: "bg-blue-200" },
    { name: "Pink", value: "bg-pink-200", class: "bg-pink-200" },
    { name: "Purple", value: "bg-purple-200", class: "bg-purple-200" },
    { name: "Orange", value: "bg-orange-200", class: "bg-orange-200" },
  ];

  const fontFamilies = [
    { name: "Monaco", value: "Monaco, Menlo, 'Ubuntu Mono', monospace" },
    { name: "Fira Code", value: "'Fira Code', monospace" },
    { name: "Source Code Pro", value: "'Source Code Pro', monospace" },
    { name: "JetBrains Mono", value: "'JetBrains Mono', monospace" },
    { name: "Consolas", value: "Consolas, 'Courier New', monospace" },
    { name: "Roboto Mono", value: "'Roboto Mono', monospace" },
  ];

  const toggleFormatting = (format: string) => {
    if (!onFormattingChange) return;
    
    const newFormatting = new Set(activeFormatting);
    if (newFormatting.has(format)) {
      newFormatting.delete(format);
    } else {
      newFormatting.add(format);
    }
    onFormattingChange(newFormatting);
  };


  return (
    <div className="flex items-center gap-2 p-3 bg-card/95 backdrop-blur-sm border rounded-lg shadow-lg h-[52px]">
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

      {/* Text Formatting Controls */}
      <div className="flex items-center gap-1">
        <Button
          variant={activeFormatting.has('bold') ? "default" : "ghost"}
          size="sm"
          onClick={() => toggleFormatting('bold')}
          className="px-2"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant={activeFormatting.has('italic') ? "default" : "ghost"}
          size="sm"
          onClick={() => toggleFormatting('italic')}
          className="px-2"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant={activeFormatting.has('underline') ? "default" : "ghost"}
          size="sm"
          onClick={() => toggleFormatting('underline')}
          className="px-2"
        >
          <Underline className="h-4 w-4" />
        </Button>
      </div>

      <div className="h-6 w-px bg-border" />

      {/* Highlighter Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <Highlighter className="h-4 w-4" />
            Highlighter
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom" className="bg-popover border w-72">
          <DropdownMenuLabel>Highlight Colors</DropdownMenuLabel>
          <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/50 rounded mx-2 mb-2">
            💡 Select a color, then select text and press <kbd className="px-1 py-0.5 bg-background rounded text-foreground font-mono text-xs">Ctrl+Alt+H</kbd> to highlight
          </div>
          {highlightColors.map((color) => (
            <DropdownMenuItem 
              key={color.name}
              onClick={() => onHighlighterChange?.(color.value)}
              className="flex items-center gap-2 p-3"
            >
              <div className={`w-4 h-4 rounded ${color.class} border`} />
              <span className="font-medium">{color.name}</span>
              {selectedHighlighter === color.value && (
                <Badge variant="default" className="text-xs ml-auto">Active</Badge>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => onHighlighterChange?.(null)}
            className="flex items-center gap-2 p-3"
          >
            <div className="w-4 h-4 rounded border bg-transparent" />
            <span className="font-medium">Clear Highlight</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="h-6 w-px bg-border" />

      {/* Font Selector Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <Type className="h-4 w-4" />
            Font
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom" className="bg-popover border w-64">
          <DropdownMenuLabel>Font Family</DropdownMenuLabel>
          {fontFamilies.map((font) => (
            <DropdownMenuItem 
              key={font.name}
              onClick={() => onFontFamilyChange?.(font.value)}
              className="flex items-center gap-2 p-3"
            >
              <span className="font-medium" style={{ fontFamily: font.value }}>
                {font.name}
              </span>
              {fontFamily === font.value && (
                <Badge variant="default" className="text-xs ml-auto">Active</Badge>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="flex-col items-start p-2">
            <div className="flex items-center gap-2 mb-1">
              <Type className="h-4 w-4" />
              <span className="font-medium text-xs">Preview</span>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              The quick brown fox jumps over the lazy dog
            </p>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}