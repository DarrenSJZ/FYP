import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { vim, getCM } from "@replit/codemirror-vim";
import { createTheme } from "@uiw/codemirror-themes";
import { tags as t } from "@lezer/highlight";
import { useTheme } from "next-themes";
import { EditorView } from "@codemirror/view";

type VimMode = "NORMAL" | "INSERT" | "VISUAL" | "V-LINE" | "COMMAND";

interface TextEditorProps {
  fontSize: number;
  vimMode: VimMode;
  onVimModeChange: (mode: VimMode) => void;
  isVimEnabled: boolean;
  initialContent?: string;
}

export function TextEditor({
  fontSize,
  vimMode,
  onVimModeChange,
  isVimEnabled,
  initialContent = "",
}: TextEditorProps) {
  const [value, setValue] = useState(initialContent);
  const { theme } = useTheme();
  const editorRef = useRef<any>(null);

  const onChange = useCallback((val: string) => {
    setValue(val);
  }, []);

  // Create Kanagawa-themed CodeMirror themes
  const kanagawaLotus = createTheme({
    theme: 'light',
    settings: {
      background: 'hsl(44, 51%, 84%)', // --background
      foreground: 'hsl(38, 16%, 39%)', // --foreground
      caret: 'hsl(221, 35%, 45%)', // --primary
      selection: 'hsl(44, 43%, 73%)', // --muted
      selectionMatch: 'hsl(44, 47%, 79%)', // --card
      lineHighlight: 'hsl(44, 47%, 79%, 0.3)',
      gutterBackground: 'hsl(44, 47%, 79%)', // --card
      gutterForeground: 'hsl(50, 12%, 41%)', // --muted-foreground
    },
    styles: [
      { tag: t.comment, color: 'hsl(50, 12%, 41%)' }, // --muted-foreground
      { tag: t.variableName, color: 'hsl(38, 16%, 39%)' }, // --foreground
      { tag: [t.string, t.special(t.string)], color: 'hsl(44, 100%, 24%)' }, // --accent
      { tag: t.number, color: 'hsl(221, 35%, 45%)' }, // --primary
      { tag: t.bool, color: 'hsl(232, 16%, 52%)' }, // --secondary
      { tag: t.null, color: 'hsl(351, 77%, 55%)' }, // --destructive
      { tag: t.keyword, color: 'hsl(232, 16%, 52%)' }, // --secondary
      { tag: t.operator, color: 'hsl(38, 16%, 39%)' }, // --foreground
      { tag: t.className, color: 'hsl(221, 35%, 45%)' }, // --primary
      { tag: t.definition(t.typeName), color: 'hsl(221, 35%, 45%)' }, // --primary
      { tag: t.typeName, color: 'hsl(221, 35%, 45%)' }, // --primary
      { tag: t.angleBracket, color: 'hsl(50, 12%, 41%)' }, // --muted-foreground
      { tag: t.tagName, color: 'hsl(232, 16%, 52%)' }, // --secondary
      { tag: t.attributeName, color: 'hsl(44, 100%, 24%)' }, // --accent
    ],
  });

  const kanagawaWave = createTheme({
    theme: 'dark',
    settings: {
      background: 'hsl(240, 10%, 15%)', // --background
      foreground: 'hsl(39, 21%, 84%)', // --foreground
      caret: 'hsl(44, 78%, 71%)', // --accent
      selection: 'hsl(240, 9%, 27%)', // --muted
      selectionMatch: 'hsl(240, 9%, 21%)', // --card
      lineHighlight: 'hsl(240, 9%, 21%, 0.3)',
      gutterBackground: 'hsl(240, 9%, 21%)', // --card
      gutterForeground: 'hsl(39, 19%, 67%)', // --muted-foreground
    },
    styles: [
      { tag: t.comment, color: 'hsl(39, 19%, 67%)' }, // --muted-foreground
      { tag: t.variableName, color: 'hsl(39, 21%, 84%)' }, // --foreground
      { tag: [t.string, t.special(t.string)], color: 'hsl(44, 78%, 71%)' }, // --accent
      { tag: t.number, color: 'hsl(213, 46%, 64%)' }, // --primary
      { tag: t.bool, color: 'hsl(249, 20%, 59%)' }, // --secondary
      { tag: t.null, color: 'hsl(2, 78%, 67%)' }, // --destructive
      { tag: t.keyword, color: 'hsl(249, 20%, 59%)' }, // --secondary
      { tag: t.operator, color: 'hsl(39, 21%, 84%)' }, // --foreground
      { tag: t.className, color: 'hsl(213, 46%, 64%)' }, // --primary
      { tag: t.definition(t.typeName), color: 'hsl(213, 46%, 64%)' }, // --primary
      { tag: t.typeName, color: 'hsl(213, 46%, 64%)' }, // --primary
      { tag: t.angleBracket, color: 'hsl(39, 19%, 67%)' }, // --muted-foreground
      { tag: t.tagName, color: 'hsl(249, 20%, 59%)' }, // --secondary
      { tag: t.attributeName, color: 'hsl(44, 78%, 71%)' }, // --accent
    ],
  });

  // Create extensions array based on VIM mode
  const extensions = useMemo(() => {
    const exts = [];
    
    if (isVimEnabled) {
      const vimExt = vim({
        status: false, // Disable built-in status indicator
      });
      exts.push(vimExt);
    }
    
    return exts;
  }, [isVimEnabled]);

  // Update content when initialContent changes
  useEffect(() => {
    setValue(initialContent);
  }, [initialContent]);

  // Monitor VIM mode changes using getCM
  useEffect(() => {
    if (!isVimEnabled || !editorRef.current?.view) return;

    const checkVimMode = () => {
      try {
        const view = editorRef.current?.view;
        if (!view) return;

        // Use getCM to access the CM5 compatibility layer
        const cm = getCM(view);
        if (cm) {
          let currentMode: VimMode = "NORMAL";
          
          // Check different ways to detect VIM mode
          if (cm.state.keyMap === 'vim-insert') {
            currentMode = "INSERT";
          } else if (cm.state.vim && cm.state.vim.mode) {
            // Try to access vim state directly
            const mode = cm.state.vim.mode;
            if (mode === "insert") {
              currentMode = "INSERT";
            } else if (mode === "visual") {
              currentMode = "VISUAL";
            } else if (mode === "visual-line") {
              currentMode = "V-LINE";
            } else if (mode === "command") {
              currentMode = "COMMAND";
            } else {
              currentMode = "NORMAL";
            }
          }

          if (currentMode !== vimMode) {
            onVimModeChange(currentMode);
          }
        }
      } catch (error) {
        console.debug("VIM mode detection error:", error);
      }
    };

    // Set initial mode to NORMAL when VIM is enabled
    if (vimMode !== "NORMAL") {
      onVimModeChange("NORMAL");
    }

    // Set up interval to check mode changes
    const interval = setInterval(checkVimMode, 200);
    
    return () => clearInterval(interval);
  }, [isVimEnabled, vimMode, onVimModeChange]);

  return (
    <div className="w-full">
      <div className="w-full relative rounded-lg overflow-hidden border border-border">
        <CodeMirror
          ref={editorRef}
          value={value}
          height="500px"
          placeholder={
            isVimEnabled
              ? "-- VIM MODE -- Press 'i' to insert, 'v' for visual mode"
              : "Start typing your transcription here..."
          }
          extensions={extensions}
          onChange={onChange}
          theme={theme === 'dark' ? kanagawaWave : kanagawaLotus}
          autoFocus={isVimEnabled}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            dropCursor: false,
            allowMultipleSelections: false,
            autocompletion: false,
            searchKeymap: isVimEnabled ? false : true,
          }}
          className="rounded-lg"
          style={{
            fontSize: `${fontSize}px`,
            fontFamily: "Monaco, Menlo, 'Ubuntu Mono', monospace",
            lineHeight: "1.6",
          }}
        />
      </div>
    </div>
  );
}