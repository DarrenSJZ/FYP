import { useState } from "react";
import { Ribbon } from "@/components/Ribbon";
import { VimToggle } from "@/components/VimToggle";
import { TextEditor } from "@/components/TextEditor";
import { AudioUpload } from "@/components/AudioUpload";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  const [fontSize, setFontSize] = useState(24);
  const [isVimEnabled, setIsVimEnabled] = useState(false);
  const [vimMode, setVimMode] = useState<"NORMAL" | "INSERT" | "VISUAL" | "V-LINE" | "COMMAND">("NORMAL");
  const [transcriptionText, setTranscriptionText] = useState("");
  const [selectedModel, setSelectedModel] = useState("parallel");
  const [selectedAnalysis, setSelectedAnalysis] = useState("basic");

  const handleVimToggle = () => {
    setIsVimEnabled(!isVimEnabled);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header Section */}
      <header className="w-full flex items-center justify-between p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold text-sm">
            LOGO
          </div>
          <span className="text-2xl font-semibold text-foreground">Accentric</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Ribbon and VIM Toggle Row */}
        <div className="flex items-start gap-4 mb-6">
          <Ribbon
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
          />
          
          {/* VIM Toggle positioned to the right with gap */}
          <VimToggle
            isVimEnabled={isVimEnabled}
            vimMode={vimMode}
            onVimToggle={handleVimToggle}
          />
        </div>
        <div className="w-full max-w-4xl">
          <Tabs defaultValue="editor" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Upload Audio</TabsTrigger>
              <TabsTrigger value="editor">Text Editor</TabsTrigger>
            </TabsList>
            
            <TabsContent value="upload" className="space-y-4">
              <AudioUpload
                onTranscriptionComplete={(text) => {
                  setTranscriptionText(text);
                  // Auto-switch to editor tab after transcription
                  setTimeout(() => {
                    const editorTab = document.querySelector('[value="editor"]') as HTMLButtonElement;
                    editorTab?.click();
                  }, 1000);
                }}
                selectedModel={selectedModel}
                selectedAnalysis={selectedAnalysis}
              />
            </TabsContent>
            
            <TabsContent value="editor">
              <TextEditor
                fontSize={fontSize}
                vimMode={vimMode}
                onVimModeChange={setVimMode}
                isVimEnabled={isVimEnabled}
                initialContent={transcriptionText}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Index;
