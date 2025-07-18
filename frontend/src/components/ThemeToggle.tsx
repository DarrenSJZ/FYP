import { Sun, Moon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  const handleToggle = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <div className="bg-card/95 backdrop-blur-sm border rounded-lg shadow-lg h-[52px] flex items-center">
      <div className="flex items-center gap-3 px-3">
        {/* Icon and Label */}
        <div className="flex items-center gap-2">
          {isDark ? (
            <Moon className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Sun className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium text-muted-foreground">THEME</span>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-border" />

        {/* Light/Dark Labels and Switch */}
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium transition-colors duration-200 ${
            !isDark ? 'text-foreground' : 'text-muted-foreground'
          }`}>
            LIGHT
          </span>
          
          <Switch
            checked={isDark}
            onCheckedChange={handleToggle}
            className="transition-all duration-300"
            style={{
              backgroundColor: isDark ? 'hsl(var(--sage-green))' : 'hsl(var(--dusty-rose))'
            }}
          />
          
          <span className={`text-xs font-medium transition-colors duration-200 ${
            isDark ? 'text-foreground' : 'text-muted-foreground'
          }`}>
            DARK
          </span>
        </div>
      </div>
    </div>
  );
}