import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, Keyboard, Palette, Type, Zap } from "lucide-react";

interface AdvancedEditorFeaturesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdvancedEditorFeaturesDialog({ isOpen, onClose }: AdvancedEditorFeaturesDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Advanced Editor Features
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="text-center">
            <p className="text-muted-foreground">
              This isn't just a text box - explore the powerful editing tools available to you
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center text-center p-4 bg-muted/30 rounded-lg">
              <Keyboard className="h-8 w-8 text-primary mb-3" />
              <span className="font-medium text-base mb-1">Vim Mode</span>
              <span className="text-sm text-muted-foreground">Professional modal editing with Normal, Insert, Visual, and Command modes</span>
            </div>
            <div className="flex flex-col items-center text-center p-4 bg-muted/30 rounded-lg">
              <Palette className="h-8 w-8 text-accent mb-3" />
              <span className="font-medium text-base mb-1">Text Highlighting</span>
              <span className="text-sm text-muted-foreground">Color-code important sections with multiple highlight colors</span>
            </div>
            <div className="flex flex-col items-center text-center p-4 bg-muted/30 rounded-lg">
              <Type className="h-8 w-8 text-[hsl(var(--sage-green))] mb-3" />
              <span className="font-medium text-base mb-1">Font Control</span>
              <span className="text-sm text-muted-foreground">Adjust font size and choose from professional monospace fonts</span>
            </div>
            <div className="flex flex-col items-center text-center p-4 bg-muted/30 rounded-lg">
              <Zap className="h-8 w-8 text-[hsl(var(--chip-brown))] mb-3" />
              <span className="font-medium text-base mb-1">Smart Features</span>
              <span className="text-sm text-muted-foreground">Auto-complete, syntax awareness, and intelligent text processing</span>
            </div>
          </div>
          
          <div className="bg-card border border-border rounded-lg p-4">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              How to Access These Features
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><strong>Ribbon Controls:</strong> Use the formatting toolbar above the editor for font, highlighting, and text formatting</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><strong>Vim Mode:</strong> Toggle the Vim switch to enable modal editing with keyboard shortcuts</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><strong>Theme Toggle:</strong> Switch between light and dark themes for comfortable editing</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><strong>Smart Autocomplete:</strong> Context-aware suggestions appear as you type</span>
              </li>
            </ul>
          </div>
          
          <div className="text-center">
            <Button onClick={onClose}>
              Got it, let's edit!
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}