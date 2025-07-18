import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { vim, getCM } from "@replit/codemirror-vim";
import { createTheme } from "@uiw/codemirror-themes";
import { tags as t } from "@lezer/highlight";
import { useTheme } from "next-themes";
import { EditorView } from "@codemirror/view";
import "../styles/autocomplete.css";

// --- Autocomplete Component Logic --- //
interface AutocompleteProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  activeSuggestionIndex: number;
}

const Autocomplete: React.FC<AutocompleteProps> = ({ suggestions, onSelect, activeSuggestionIndex }) => {
  return (
    <ul className="autocomplete-dropdown">
      {suggestions.map((suggestion, index) => (
        <li
          key={index}
          className={`autocomplete-suggestion ${index === activeSuggestionIndex ? "selected" : ""}`}
          onClick={() => onSelect(suggestion)}
        >
          {suggestion}
        </li>
      ))}
    </ul>
  );
};

// --- TextEditor Component --- //
type VimMode = "NORMAL" | "INSERT" | "VISUAL" | "V-LINE" | "V-BLOCK" | "COMMAND";

interface TextEditorProps {
  fontSize: number;
  vimMode: VimMode;
  onVimModeChange: (mode: VimMode) => void;
  isVimEnabled: boolean;
  initialContent?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  audioId?: string;
}

export function TextEditor({
  fontSize,
  vimMode,
  onVimModeChange,
  isVimEnabled,
  initialContent = "",
  onChange,
  placeholder = "",
  audioId,
}: TextEditorProps) {
  const [value, setValue] = useState(initialContent);
  const { theme } = useTheme();
  const editorRef = useRef<any>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);

  const handleChange = useCallback(async (val: string) => {
    setValue(val);
    onChange?.(val);

    console.log("handleChange triggered. Current value:", val);
    console.log("Using audioId:", audioId);

    const words = val.split(/\s+/);
    const currentWord = words[words.length - 1];

    console.log("Current word:", currentWord);

    if (currentWord && currentWord.length > 0) {
      try {
        const url = `http://localhost:8007/suggest/prefix?prefix=${encodeURIComponent(currentWord)}`;
        console.log("Fetching suggestions from:", url);
        const response = await fetch(url);
        console.log("Fetch response status:", response.status);

        if (response.ok) {
          const data = await response.json();
          console.log("Received suggestions data:", data);
          setSuggestions(data.suggestions || []);
          setActiveSuggestionIndex(0); // Reset selection
        } else {
          const errorText = await response.text();
          console.error("Error response from autocomplete service:", response.status, errorText);
          setSuggestions([]);
        }
      } catch (error) {
        console.error('Error fetching autocomplete suggestions:', error);
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
      if (!audioId) {
        console.warn("audioId is missing, cannot fetch autocomplete suggestions.");
      }
      if (!currentWord || currentWord.length === 0) {
        console.log("No current word to get suggestions for.");
      }
    }
  }, [onChange, audioId]);

  const handleSuggestionSelect = (suggestion: string) => {
    const words = value.split(/\s+/);
    words[words.length - 1] = suggestion;
    const newValue = words.join(' ') + ' ';
    setValue(newValue);
    onChange?.(newValue);
    setSuggestions([]);
    editorRef.current?.view?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestionIndex(prevIndex => (prevIndex + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestionIndex(prevIndex => (prevIndex - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      handleSuggestionSelect(suggestions[activeSuggestionIndex]);
    }
  };

  const kanagawaLotus = createTheme({ theme: 'light', settings: { background: 'hsl(44, 51%, 84%)', foreground: 'hsl(38, 16%, 39%)', caret: 'hsl(221, 35%, 45%)', selection: 'hsl(44, 43%, 73%)', selectionMatch: 'hsl(44, 47%, 79%)', lineHeight: '1.6', gutterBackground: 'hsl(44, 47%, 79%)', gutterForeground: 'hsl(50, 12%, 41%)' } });
  const kanagawaWave = createTheme({ theme: 'dark', settings: { background: 'hsl(240, 10%, 15%)', foreground: 'hsl(39, 21%, 84%)', caret: 'hsl(44, 78%, 71%)', selection: 'hsl(240, 9%, 27%)', selectionMatch: 'hsl(240, 9%, 21%)', lineHeight: '1.6', gutterBackground: 'hsl(240, 9%, 21%)', gutterForeground: 'hsl(39, 19%, 67%)' } });

  const extensions = useMemo(() => {
    const exts = [];
    if (isVimEnabled) {
      exts.push(vim({ status: false }));
    }
    exts.push(EditorView.lineWrapping);
    return exts;
  }, [isVimEnabled]);

  useEffect(() => {
    setValue(initialContent);
  }, [initialContent]);

  useEffect(() => {
    if (!isVimEnabled) {
      onVimModeChange("NORMAL");
      return;
    }
    onVimModeChange("NORMAL");
    let lastReportedMode: VimMode = "NORMAL";
    try {
      const cm = getCM(editorRef.current?.view);
      if (!cm) return;
      const handleVimModeChange = (modeInfo: any) => {
        const mode = modeInfo.mode.toLowerCase();
        let currentMode: VimMode = ["insert", "visual", "visual-line", "visual-block", "command"].includes(mode) ? mode.toUpperCase() as VimMode : "NORMAL";
        if (currentMode !== lastReportedMode) {
          lastReportedMode = currentMode;
          onVimModeChange(currentMode);
        }
      };
      cm.on('vim-mode-change', handleVimModeChange);
      return () => { cm.off('vim-mode-change', handleVimModeChange); };
    } catch (error) {
      console.error("VIM mode detection setup error:", error);
    }
  }, [isVimEnabled, onVimModeChange]);

  return (
    <div className="w-full" onKeyDown={handleKeyDown}>
      <div className="w-[1200px] relative rounded-lg overflow-hidden border border-border">
        <CodeMirror
          ref={editorRef}
          value={value}
          height="120px"
          placeholder={placeholder}
          extensions={extensions}
          onChange={handleChange}
          theme={theme === 'dark' ? kanagawaWave : kanagawaLotus}
          autoFocus={isVimEnabled}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            dropCursor: false,
            allowMultipleSelections: false,
            autocompletion: false, // Disable default autocompletion
            searchKeymap: !isVimEnabled,
          }}
          className="rounded-lg"
          style={{ fontSize: `${fontSize}px`, fontFamily: "Monaco, Menlo, 'Ubuntu Mono', monospace", lineHeight: "1.6" }}
        />
        {suggestions.length > 0 && (
          <Autocomplete 
            suggestions={suggestions} 
            onSelect={handleSuggestionSelect} 
            activeSuggestionIndex={activeSuggestionIndex} 
          />
        )}
      </div>
    </div>
  );
}