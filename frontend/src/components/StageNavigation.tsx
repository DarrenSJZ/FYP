import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";

interface StageNavigationProps {
  onBack?: () => void;
  onNext?: () => void;
  backText?: string;
  nextText?: string;
  nextDisabled?: boolean;
  backDisabled?: boolean;
  showBack?: boolean;
  showNext?: boolean;
}

export function StageNavigation({
  onBack,
  onNext,
  backText = "Back",
  nextText = "Next",
  nextDisabled = false,
  backDisabled = false,
  showBack = true,
  showNext = true,
}: StageNavigationProps) {
  return (
    <div className="w-full flex justify-between items-center pb-6 border-b border-border">
      {/* Back Button */}
      {showBack ? (
        <Button
          onClick={onBack}
          variant="outline"
          disabled={backDisabled}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {backText}
        </Button>
      ) : (
        <div></div> // Empty div to maintain spacing
      )}

      {/* Next Button */}
      {showNext && onNext ? (
        <Button
          onClick={onNext}
          disabled={nextDisabled}
          className="gap-2"
        >
          {nextText}
          <ArrowRight className="h-4 w-4" />
        </Button>
      ) : (
        <div></div> // Empty div to maintain spacing
      )}
    </div>
  );
}