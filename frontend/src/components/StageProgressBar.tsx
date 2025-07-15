import { cn } from "@/lib/utils";
import { Check, MapPin } from "lucide-react";
import type { WorkflowStage } from "@/pages/Index";

interface StageProgressBarProps {
  currentStage: WorkflowStage;
  completedStages: Set<WorkflowStage>;
  onStageClick?: (stage: WorkflowStage) => void;
}

const stages = [
  { id: "validation" as WorkflowStage, label: "Validation", number: 1 },
  { id: "accent" as WorkflowStage, label: "Accent Selection", number: 2 },
  { id: "particle-placement" as WorkflowStage, label: "Particle Placement", number: 3 },
  { id: "comparison" as WorkflowStage, label: "Final Comparison", number: 4 },
];

export function StageProgressBar({ 
  currentStage, 
  completedStages, 
  onStageClick 
}: StageProgressBarProps) {
  const getStageStatus = (stage: WorkflowStage) => {
    if (completedStages.has(stage)) return "completed";
    if (stage === currentStage) return "current";
    return "upcoming";
  };

  const isClickable = (stage: WorkflowStage) => {
    return completedStages.has(stage) || stage === currentStage;
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-center gap-8">
        {stages.map((stage, index) => {
          const status = getStageStatus(stage.id);
          const clickable = isClickable(stage.id);
          // Theme-aware color classes
          const isDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
          // Color variables
          const currentColor = isDark ? 'bg-primary border-primary text-primary-foreground' : 'bg-accent border-accent text-accent-foreground';
          const completedColor = isDark ? 'bg-primary border-primary text-primary-foreground' : 'bg-muted border-accent text-accent-foreground';
          const lineColor = isDark ? 'bg-primary' : 'bg-accent';

          return (
            <div key={stage.id} className="flex items-center">
              {/* Stage Circle */}
              <div
                className={cn(
                  "relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-200 aspect-square",
                  status === "completed" && completedColor,
                  status === "current" && currentColor,
                  status === "upcoming" && "bg-muted border-muted-foreground/30 text-muted-foreground",
                  clickable && onStageClick && "cursor-pointer hover:scale-105",
                  !clickable && "cursor-not-allowed"
                )}
                onClick={() => clickable && onStageClick?.(stage.id)}
              >
                {status === "completed" ? (
                  <Check className="w-5 h-5" />
                ) : status === "current" ? (
                  <MapPin className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-semibold">{stage.number}</span>
                )}
              </div>
              
              {/* Stage Label */}
              <div className="ml-3">
                <p
                  className={cn(
                    "text-sm font-medium transition-colors duration-200",
                    status === "current" && (isDark ? "text-primary" : "text-accent-foreground"),
                    status === "completed" && (isDark ? "text-foreground" : "text-accent-foreground"),
                    status === "upcoming" && "text-muted-foreground",
                    clickable && onStageClick && "cursor-pointer hover:text-accent",
                    !clickable && "cursor-not-allowed"
                  )}
                  onClick={() => clickable && onStageClick?.(stage.id)}
                >
                  {stage.label}
                </p>
              </div>
              
              {/* Progress Line */}
              {index < stages.length - 1 && (
                <div className={`mx-4 h-0.5 w-12 ${status === 'completed' || status === 'current' ? lineColor : 'bg-muted'}`}></div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}