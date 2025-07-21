import { useState } from "react";
import { Moon, Sun, Minus, Plus, Settings, Terminal, Type, Mic, Headphones, Globe, Brain, Zap, MessageSquare, Highlighter, Bold, Italic, Underline, HelpCircle } from "lucide-react";
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
  onClearHighlights?: () => void;
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
  onClearHighlights,
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
      {/* Keyboard Shortcuts Cheat Sheet */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="px-2">
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom" className="w-80 p-4">
          <DropdownMenuLabel className="text-sm font-semibold mb-3">Keyboard Shortcuts</DropdownMenuLabel>
          
          <div className="space-y-3">
            <div className="text-xs">
              <div className="font-medium mb-2 text-foreground">Formatting:</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono text-xs">Ctrl+Alt+B</kbd>
                  <span>Bold</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono text-xs">Ctrl+Alt+I</kbd>
                  <span>Italic</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono text-xs">Ctrl+Alt+U</kbd>
                  <span>Underline</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono text-xs">Ctrl+Alt+F</kbd>
                  <span>Apply Format</span>
                </div>
              </div>
            </div>
            
            <DropdownMenuSeparator />
            
            <div className="text-xs">
              <div className="font-medium mb-2 text-foreground">Highlighting:</div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono text-xs">Ctrl+Alt+H</kbd>
                  <span>Apply Highlight</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono text-xs">Ctrl+Alt+C</kbd>
                  <span>Clear All Highlights</span>
                </div>
              </div>
            </div>
            
            <DropdownMenuSeparator />
            
            <div className="text-xs">
              <div className="font-medium mb-2 text-foreground">Universal:</div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono text-xs">Ctrl+Alt+Enter</kbd>
                <span>Apply All Active Settings</span>
              </div>
            </div>
            
            <DropdownMenuSeparator />
            
            <div className="text-xs text-muted-foreground">
              💡 Select text first, then use shortcuts to apply formatting/highlighting
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

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

      {/* Text Formatting Controls */}
      <div className="flex items-center gap-1">
        <Button
          variant={activeFormatting.has('bold') ? "default" : "ghost"}
          size="sm"
          onClick={() => toggleFormatting('bold')}
          className="px-2"
          title="Bold (Ctrl+Alt+B)"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant={activeFormatting.has('italic') ? "default" : "ghost"}
          size="sm"
          onClick={() => toggleFormatting('italic')}
          className="px-2"
          title="Italic (Ctrl+Alt+I)"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant={activeFormatting.has('underline') ? "default" : "ghost"}
          size="sm"
          onClick={() => toggleFormatting('underline')}
          className="px-2"
          title="Underline (Ctrl+Alt+U)"
        >
          <Underline className="h-4 w-4" />
        </Button>
      </div>

      <div className="h-6 w-px bg-border" />

      {/* Highlighter Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2" title="Highlighter (Ctrl+Alt+H)">
            <Highlighter className="h-4 w-4" />
            Highlighter
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom" className="bg-popover border w-56">
          <DropdownMenuLabel>Highlight Colors</DropdownMenuLabel>
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
            onClick={() => {
              onHighlighterChange?.(null);
              onClearHighlights?.();
            }}
            className="flex items-center gap-2 p-3"
          >
            <div className="w-4 h-4 rounded border bg-transparent" />
            <span className="font-medium">Clear All Highlights</span>
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