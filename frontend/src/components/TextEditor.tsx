import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { vim, getCM } from "@replit/codemirror-vim";
import { createTheme } from "@uiw/codemirror-themes";
import { tags as t } from "@lezer/highlight";
import { useTheme } from "next-themes";
import { EditorView, keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { autocompletion, CompletionContext, CompletionResult, acceptCompletion, moveCompletionSelection, completionStatus, currentCompletions } from "@codemirror/autocomplete";
import "../styles/autocomplete.css";

// --- CodeMirror 6 Native Autocomplete Source --- //
const redisCompletionSource = async (context: CompletionContext): Promise<CompletionResult | null> => {
  const word = context.matchBefore(/\w*/);
  if (!word || word.text.length < 1) return null;

  try {
    console.log("CodeMirror autocomplete - fetching for:", word.text);
    const response = await fetch(`http://localhost:8007/suggest/prefix?prefix=${encodeURIComponent(word.text)}`);
    
    if (!response.ok) {
      console.error("CodeMirror autocomplete - API error:", response.status);
      return null;
    }

    const data = await response.json();
    console.log("CodeMirror autocomplete - received data:", data);

    if (!data.suggestions || data.suggestions.length === 0) {
      return null;
    }

    const options = data.suggestions.map((suggestion: any) => {
      // Generate model info based on confidence score
      const conf = suggestion.confidence || 0;
      let modelInfo = "";
      
      if (conf > 0.95) {
        modelInfo = "whisper+wav2vec";
      } else if (conf > 0.9) {
        modelInfo = "whisper";
      } else if (conf > 0.8) {
        modelInfo = "wav2vec";
      } else {
        modelInfo = "detected";
      }
      
      return {
        label: suggestion.text || suggestion,
        apply: suggestion.text || suggestion,
        detail: `${modelInfo} (${conf.toFixed(2)})`,
        info: `Confidence: ${conf.toFixed(2)} | Models: ${modelInfo}`,
        // Remove type to avoid showing the mathematical x symbol
        type: undefined
      };
    });

    return {
      from: word.from,
      options,
      filter: false // We handle filtering on the server side
    };
  } catch (error) {
    console.error("CodeMirror autocomplete - fetch error:", error);
    return null;
  }
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

  const handleChange = useCallback((val: string) => {
    setValue(val);
    onChange?.(val);
  }, [onChange]);


  const kanagawaLotus = createTheme({ theme: 'light', settings: { background: 'hsl(44, 51%, 84%)', foreground: 'hsl(38, 16%, 39%)', caret: 'hsl(221, 35%, 45%)', selection: 'hsl(44, 43%, 73%)', selectionMatch: 'hsl(44, 47%, 79%)', lineHeight: '1.6', gutterBackground: 'hsl(44, 47%, 79%)', gutterForeground: 'hsl(50, 12%, 41%)' } });
  const kanagawaWave = createTheme({ theme: 'dark', settings: { background: 'hsl(240, 10%, 15%)', foreground: 'hsl(39, 21%, 84%)', caret: 'hsl(44, 78%, 71%)', selection: 'hsl(240, 9%, 27%)', selectionMatch: 'hsl(240, 9%, 21%)', lineHeight: '1.6', gutterBackground: 'hsl(240, 9%, 21%)', gutterForeground: 'hsl(39, 19%, 67%)' } });

  const extensions = useMemo(() => {
    const exts = [];
    
    // Custom keymap for Tab autocomplete navigation with highest priority
    const customKeymap = Prec.highest(keymap.of([
      {
        key: "Tab",
        preventDefault: true,
        stopPropagation: true,
        run: (editor) => {
          console.log("Tab pressed - completion status:", completionStatus(editor.state));
          if (completionStatus(editor.state)) {
            const completions = currentCompletions(editor.state);
            const current = completions?.selected || 0;
            const total = completions?.options.length || 0;
            
            console.log(`Current: ${current}, Total: ${total}`);
            
            if (current < total - 1) {
              console.log("Moving down through completions");
              return moveCompletionSelection(false)(editor); // Move down if not at end
            } else {
              console.log("At bottom - not moving");
              return true; // At bottom, don't move
            }
          }
          console.log("No completion active - blocking tab");
          return true; // Block tab when no completion is active
        },
      },
      {
        key: "Shift-Tab",
        preventDefault: true,
        stopPropagation: true,
        run: (editor) => {
          if (completionStatus(editor.state)) {
            const completions = currentCompletions(editor.state);
            const current = completions?.selected || 0;
            
            if (current > 0) {
              return moveCompletionSelection(true)(editor); // Move up if not at top
            } else {
              return true; // At top, don't move
            }
          }
          return true; // Block Shift-Tab when no completion is active
        },
      },
      {
        key: "ArrowDown",
        run: (editor) => {
          if (completionStatus(editor.state)) {
            return moveCompletionSelection(false)(editor); // Move forward through suggestions
          }
          return false; // Allow default arrow behavior if no completion
        },
      },
      {
        key: "ArrowUp",
        run: (editor) => {
          if (completionStatus(editor.state)) {
            return moveCompletionSelection(true)(editor); // Move backward through suggestions
          }
          return false; // Allow default arrow behavior if no completion
        },
      },
      {
        key: "Enter",
        run: (editor) => {
          if (completionStatus(editor.state)) {
            return acceptCompletion(editor);
          }
          return false; // Allow default Enter behavior if no completion
        },
      },
      {
        key: "Escape",
        run: (editor) => {
          if (completionStatus(editor.state)) {
            // Close completion without accepting
            return true;
          }
          return false; // Allow default Escape behavior if no completion
        },
      },
    ]));
    
    exts.push(customKeymap);
    
    // Add native CodeMirror autocomplete without default keymap
    exts.push(autocompletion({
      override: [redisCompletionSource],
      activateOnTyping: true,
      maxRenderedOptions: 10,
      defaultKeymap: false, // Disable default keymap, use our custom one
      selectOnOpen: true, // Auto-select first option
      closeOnBlur: true
    }));
    
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
    <div className="w-full">
      <div className="w-full relative rounded-lg overflow-hidden border border-border">
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
            lineNumbers: false,
            foldGutter: false,
            dropCursor: false,
            allowMultipleSelections: false,
            autocompletion: false, // Disable default autocompletion
            searchKeymap: !isVimEnabled,
            tabSize: 2,
            indentOnInput: false,
          }}
          className="rounded-lg"
          style={{ fontSize: `${fontSize}px`, fontFamily: "Monaco, Menlo, 'Ubuntu Mono', monospace", lineHeight: "1.6" }}
        />
      </div>
    </div>
  );
}