import { useState, useCallback, useMemo, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { vim, getCM } from "@replit/codemirror-vim";
import { createTheme } from "@uiw/codemirror-themes";
import { useTheme } from "next-themes";
import { EditorView, keymap, Decoration, DecorationSet } from "@codemirror/view";
import { Prec, StateEffect, StateField, EditorSelection } from "@codemirror/state";
import { autocompletion, CompletionContext, CompletionResult, acceptCompletion, moveCompletionSelection, completionStatus, currentCompletions } from "@codemirror/autocomplete";
import "../styles/autocomplete.css";

// --- Text Highlighting System --- //
// Define the highlight effect
const addHighlight = StateEffect.define<{from: number, to: number, color: string}>();
const removeHighlight = StateEffect.define<{from: number, to: number}>();
const clearHighlights = StateEffect.define();

// Define formatting effects
const addFormatting = StateEffect.define<{from: number, to: number, formats: Set<string>}>();
const removeFormatting = StateEffect.define<{from: number, to: number, format: string}>();
const clearAllFormatting = StateEffect.define();

// Create highlight decorations for different colors
const createHighlightDecoration = (color: string) => {
  const colorMap: { [key: string]: string } = {
    'bg-yellow-200': 'rgba(254, 240, 138, 0.5)',
    'bg-green-200': 'rgba(187, 247, 208, 0.5)',
    'bg-blue-200': 'rgba(191, 219, 254, 0.5)',
    'bg-pink-200': 'rgba(251, 207, 232, 0.5)',
    'bg-purple-200': 'rgba(221, 214, 254, 0.5)',
    'bg-orange-200': 'rgba(254, 215, 170, 0.5)',
  };
  
  return Decoration.mark({
    attributes: {
      style: `background-color: ${colorMap[color] || colorMap['bg-yellow-200']}`
    }
  });
};

// Create formatting decorations
const createFormattingDecoration = (formats: Set<string>) => {
  const styles: string[] = [];
  
  if (formats.has('bold')) styles.push('font-weight: bold');
  if (formats.has('italic')) styles.push('font-style: italic');
  if (formats.has('underline')) styles.push('text-decoration: underline');
  
  return Decoration.mark({
    attributes: {
      style: styles.join('; ')
    }
  });
};

// State field to manage highlights
const highlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(highlights, transaction) {
    highlights = highlights.map(transaction.changes);
    
    for (let effect of transaction.effects) {
      if (effect.is(addHighlight)) {
        const { from, to, color } = effect.value;
        const decoration = createHighlightDecoration(color);
        highlights = highlights.update({
          add: [decoration.range(from, to)],
          sort: true
        });
      } else if (effect.is(removeHighlight)) {
        const { from, to } = effect.value;
        highlights = highlights.update({
          filter: (from_pos, to_pos) => !(from_pos === from && to_pos === to)
        });
      } else if (effect.is(clearHighlights)) {
        highlights = Decoration.none;
      }
    }
    
    return highlights;
  },
  provide: f => EditorView.decorations.from(f)
});

// State field to manage text formatting with individual format tracking
const formattingField = StateField.define<{decorations: DecorationSet, formatMap: Map<string, Set<string>>}>({
  create() {
    return { decorations: Decoration.none, formatMap: new Map() };
  },
  update(state, transaction) {
    let { decorations, formatMap } = state;
    decorations = decorations.map(transaction.changes);
    
    // Update position keys in formatMap based on changes
    const newFormatMap = new Map<string, Set<string>>();
    for (const [key, formats] of formatMap) {
      const [from, to] = key.split('-').map(Number);
      const mapped = transaction.changes.mapPos(from);
      const mappedTo = transaction.changes.mapPos(to);
      if (mapped !== null && mappedTo !== null) {
        newFormatMap.set(`${mapped}-${mappedTo}`, formats);
      }
    }
    formatMap = newFormatMap;
    
    for (let effect of transaction.effects) {
      if (effect.is(addFormatting)) {
        const { from, to, formats } = effect.value;
        const key = `${from}-${to}`;
        
        // Merge with existing formats at this position
        const existing = formatMap.get(key) || new Set();
        const merged = new Set([...existing, ...formats]);
        formatMap.set(key, merged);
        
        const decoration = createFormattingDecoration(merged);
        decorations = decorations.update({
          add: [decoration.range(from, to)],
          sort: true
        });
      } else if (effect.is(removeFormatting)) {
        const { from, to, format } = effect.value;
        const key = `${from}-${to}`;
        
        if (formatMap.has(key)) {
          const existing = formatMap.get(key)!;
          existing.delete(format);
          
          if (existing.size === 0) {
            // Remove decoration entirely if no formats left
            formatMap.delete(key);
            decorations = decorations.update({
              filter: (from_pos, to_pos) => !(from_pos === from && to_pos === to)
            });
          } else {
            // Update decoration with remaining formats
            formatMap.set(key, existing);
            const decoration = createFormattingDecoration(existing);
            decorations = decorations.update({
              filter: (from_pos, to_pos) => !(from_pos === from && to_pos === to),
              add: [decoration.range(from, to)],
              sort: true
            });
          }
        }
      } else if (effect.is(clearAllFormatting)) {
        decorations = Decoration.none;
        formatMap.clear();
      }
    }
    
    return { decorations, formatMap };
  },
  provide: f => EditorView.decorations.from(f, state => state.decorations)
});

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
        modelInfo = "high confidence";
      } else if (conf > 0.9) {
        modelInfo = "good confidence";
      } else if (conf > 0.8) {
        modelInfo = "medium confidence";
      } else {
        modelInfo = "low confidence";
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
  fontFamily?: string;
  vimMode: VimMode;
  onVimModeChange: (mode: VimMode) => void;
  isVimEnabled: boolean;
  initialContent?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  audioId?: string;
  highlightColor?: string | null;
  onHighlightApplied?: (from: number, to: number, color: string) => void;
  activeFormatting?: Set<string>;
  onFormattingApplied?: (from: number, to: number, formats: Set<string>) => void;
  onFormattingChange?: (formatting: Set<string>) => void;
  onHighlighterChange?: (color: string | null) => void;
  onClearHighlights?: () => void;
}

export const TextEditor = forwardRef<{clearAllHighlights: () => void}, TextEditorProps>(function TextEditor({
  fontSize,
  fontFamily = "Monaco, Menlo, 'Ubuntu Mono', monospace",
  vimMode,
  onVimModeChange,
  isVimEnabled,
  initialContent = "",
  onChange,
  placeholder = "",
  audioId,
  highlightColor,
  onHighlightApplied,
  activeFormatting = new Set(),
  onFormattingApplied,
  onFormattingChange,
  onHighlighterChange,
  onClearHighlights,
}, ref) {
  const [value, setValue] = useState(initialContent);
  const { theme } = useTheme();
  const editorRef = useRef<any>(null);

  const handleChange = useCallback((val: string) => {
    setValue(val);
    onChange?.(val);
  }, [onChange]);

  const kanagawaLotus = createTheme({ theme: 'light', settings: { background: 'hsl(44, 51%, 84%)', foreground: 'hsl(38, 16%, 39%)', caret: 'hsl(221, 35%, 45%)', selection: 'hsl(44, 43%, 73%)', selectionMatch: 'hsl(44, 47%, 79%)', lineHeight: '1.6', gutterBackground: 'hsl(44, 47%, 79%)', gutterForeground: 'hsl(50, 12%, 41%)' } });
  const kanagawaWave = createTheme({ theme: 'dark', settings: { background: 'hsl(240, 10%, 15%)', foreground: 'hsl(39, 21%, 84%)', caret: 'hsl(44, 78%, 71%)', selection: 'hsl(240, 9%, 27%)', selectionMatch: 'hsl(240, 9%, 21%)', lineHeight: '1.6', gutterBackground: 'hsl(240, 9%, 21%)', gutterForeground: 'hsl(39, 19%, 67%)' } });

  // Function to apply highlight to selected text
  const applyHighlightToSelection = useCallback(() => {
    if (!highlightColor || !editorRef.current) return;
    
    const view = editorRef.current.view;
    if (!view) return;
    
    const selection = view.state.selection.main;
    if (selection.empty) return; // No text selected
    
    const { from, to } = selection;
    view.dispatch({
      effects: addHighlight.of({ from, to, color: highlightColor })
    });
    
    // Clear selection after highlighting
    view.dispatch({
      selection: EditorSelection.single(to)
    });
    
    onHighlightApplied?.(from, to, highlightColor);
  }, [highlightColor, onHighlightApplied]);

  // Function to clear all highlights
  const clearAllHighlights = useCallback(() => {
    if (!editorRef.current) return;
    
    const view = editorRef.current.view;
    if (!view) return;
    
    view.dispatch({
      effects: clearHighlights.of(null)
    });
    
    onClearHighlights?.();
  }, [onClearHighlights]);

  // Expose clearAllHighlights function to parent via ref
  useImperativeHandle(ref, () => ({
    clearAllHighlights
  }), [clearAllHighlights]);


  const extensions = useMemo(() => {
    const exts = [];
    
    // Add highlighting field
    exts.push(highlightField);
    
    // Add formatting field
    exts.push(formattingField);
    
    // Add custom keymap for highlighting and formatting
    const customKeymaps = [];
    
    if (highlightColor) {
      customKeymaps.push({
        key: "Ctrl-Alt-h",
        run: () => {
          applyHighlightToSelection();
          return true;
        }
      });
    }
    
    if (activeFormatting.size > 0) {
      customKeymaps.push({
        key: "Ctrl-Alt-f",
        run: () => {
          // Use the same logic as individual shortcuts to ensure consistency
          const view = editorRef.current?.view;
          if (view) {
            const selection = view.state.selection.main;
            if (!selection.empty) {
              view.dispatch({
                effects: addFormatting.of({ from: selection.from, to: selection.to, formats: activeFormatting })
              });
              view.dispatch({
                selection: EditorSelection.single(selection.to)
              });
            }
          }
          return true;
        }
      });
    }
    
    // Universal applicator - applies current ribbon state to selection
    customKeymaps.push({
      key: "Ctrl-Alt-Enter",
      run: () => {
        const view = editorRef.current?.view;
        if (view) {
          const selection = view.state.selection.main;
          if (!selection.empty) {
            // Apply current ribbon formatting using the consistent tracking system
            if (activeFormatting.size > 0) {
              view.dispatch({
                effects: addFormatting.of({ from: selection.from, to: selection.to, formats: activeFormatting })
              });
            }
            
            // Apply current ribbon highlighter
            if (highlightColor) {
              view.dispatch({
                effects: addHighlight.of({ from: selection.from, to: selection.to, color: highlightColor })
              });
            }
            
            view.dispatch({
              selection: EditorSelection.single(selection.to)
            });
          }
        }
        return true;
      }
    });

    // Individual formatting shortcuts - update ribbon state AND apply/remove formatting from selection
    customKeymaps.push({
      key: "Ctrl-Alt-b",
      run: () => {
        // Toggle bold in ribbon state
        const newFormatting = new Set(activeFormatting);
        const wasActive = newFormatting.has('bold');
        if (wasActive) {
          newFormatting.delete('bold');
        } else {
          newFormatting.add('bold');
        }
        onFormattingChange?.(newFormatting);
        
        // Apply or remove formatting from selection if text is selected
        const view = editorRef.current?.view;
        if (view) {
          const selection = view.state.selection.main;
          if (!selection.empty) {
            if (wasActive) {
              // Remove bold formatting - dispatch remove effect
              view.dispatch({
                effects: removeFormatting.of({ from: selection.from, to: selection.to, format: 'bold' })
              });
            } else {
              // Add bold formatting
              view.dispatch({
                effects: addFormatting.of({ from: selection.from, to: selection.to, formats: new Set(['bold']) })
              });
            }
            view.dispatch({
              selection: EditorSelection.single(selection.to)
            });
          }
        }
        
        return true;
      }
    });
    
    customKeymaps.push({
      key: "Ctrl-Alt-i",
      run: () => {
        // Toggle italic in ribbon state  
        const newFormatting = new Set(activeFormatting);
        const wasActive = newFormatting.has('italic');
        if (wasActive) {
          newFormatting.delete('italic');
        } else {
          newFormatting.add('italic');
        }
        onFormattingChange?.(newFormatting);
        
        // Apply or remove formatting from selection if text is selected
        const view = editorRef.current?.view;
        if (view) {
          const selection = view.state.selection.main;
          if (!selection.empty) {
            if (wasActive) {
              // Remove italic formatting
              view.dispatch({
                effects: removeFormatting.of({ from: selection.from, to: selection.to, format: 'italic' })
              });
            } else {
              // Add italic formatting
              view.dispatch({
                effects: addFormatting.of({ from: selection.from, to: selection.to, formats: new Set(['italic']) })
              });
            }
            view.dispatch({
              selection: EditorSelection.single(selection.to)
            });
          }
        }
        return true;
      }
    });
    
    customKeymaps.push({
      key: "Ctrl-Alt-u",
      run: () => {
        // Toggle underline in ribbon state
        const newFormatting = new Set(activeFormatting);
        const wasActive = newFormatting.has('underline');
        if (wasActive) {
          newFormatting.delete('underline');
        } else {
          newFormatting.add('underline');
        }
        onFormattingChange?.(newFormatting);
        
        // Apply or remove formatting from selection if text is selected
        const view = editorRef.current?.view;
        if (view) {
          const selection = view.state.selection.main;
          if (!selection.empty) {
            if (wasActive) {
              // Remove underline formatting
              view.dispatch({
                effects: removeFormatting.of({ from: selection.from, to: selection.to, format: 'underline' })
              });
            } else {
              // Add underline formatting
              view.dispatch({
                effects: addFormatting.of({ from: selection.from, to: selection.to, formats: new Set(['underline']) })
              });
            }
            view.dispatch({
              selection: EditorSelection.single(selection.to)
            });
          }
        }
        return true;
      }
    });

    // Clear highlights shortcut
    customKeymaps.push({
      key: "Ctrl-Alt-c",
      run: () => {
        clearAllHighlights();
        // Also clear the ribbon highlighter selection
        onHighlighterChange?.(null);
        return true;
      }
    });
    
    if (customKeymaps.length > 0) {
      exts.push(keymap.of(customKeymaps));
    }
    
    // Add native CodeMirror autocomplete with default keymap
    exts.push(autocompletion({
      override: [redisCompletionSource],
      activateOnTyping: true,
      maxRenderedOptions: 10,
      defaultKeymap: true, // Use CodeMirror's built-in keymap
      selectOnOpen: true, // Auto-select first option
      closeOnBlur: true,
      tooltipClass: () => "custom-autocomplete-tooltip"
    }));
    
    if (isVimEnabled) {
      exts.push(vim({ status: false }));
    }
    exts.push(EditorView.lineWrapping);
    return exts;
  }, [isVimEnabled, fontFamily, highlightColor, applyHighlightToSelection, activeFormatting, clearAllHighlights]);

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
      <div 
        className="w-full relative rounded-lg overflow-hidden border border-border"
        style={{ fontFamily: fontFamily }}
      >
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
          style={{ 
            fontSize: `${fontSize}px`, 
            fontFamily: fontFamily, 
            lineHeight: "1.6"
          }}
        />
      </div>
    </div>
  );
});