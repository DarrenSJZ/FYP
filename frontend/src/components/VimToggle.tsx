import { Terminal } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

type VimMode = "NORMAL" | "INSERT" | "VISUAL" | "V-LINE" | "COMMAND";

interface VimToggleProps {
  isVimEnabled: boolean;
  vimMode: VimMode;
  onVimToggle: () => void;
}

export function VimToggle({ isVimEnabled, vimMode, onVimToggle }: VimToggleProps) {
  return (
    <div className="bg-card/95 backdrop-blur-sm border rounded-lg shadow-lg h-[52px] flex items-center">
      <div className="flex items-center gap-3 px-3">
        {/* Icon and Label */}
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">VIM</span>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-border" />

        {/* ON/OFF Labels and Switch */}
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium transition-colors duration-200 ${
            !isVimEnabled ? 'text-foreground' : 'text-muted-foreground'
          }`}>
            OFF
          </span>
          
          <Switch
            checked={isVimEnabled}
            onCheckedChange={onVimToggle}
            className="transition-all duration-300"
            style={{
              backgroundColor: isVimEnabled ? 'hsl(var(--sage-green))' : 'hsl(var(--dusty-rose))'
            }}
          />
          
          <span className={`text-xs font-medium transition-colors duration-200 ${
            isVimEnabled ? 'text-foreground' : 'text-muted-foreground'
          }`}>
            ON
          </span>
        </div>

        {/* Animated Status Badge - Only shows when VIM is enabled */}
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isVimEnabled 
            ? 'max-w-[80px] opacity-100 transform translate-x-0' 
            : 'max-w-0 opacity-0 transform translate-x-2'
        }`}>
          <Badge 
            variant="default"
            className="text-xs bg-primary text-primary-foreground whitespace-nowrap ml-1"
          >
            {vimMode}
          </Badge>
        </div>
      </div>
    </div>
  );
}