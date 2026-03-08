import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlideNavigationProps {
  currentSlide: number;
  totalSlides: number;
  onPrev: () => void;
  onNext: () => void;
  isLastSlide: boolean;
  onCompleteModule: () => void;
  t: (key: string) => string;
}

const SlideNavigation = ({
  currentSlide,
  totalSlides,
  onPrev,
  onNext,
  isLastSlide,
  onCompleteModule,
  t,
}: SlideNavigationProps) => {
  return (
    <div className="flex items-center justify-between gap-4 px-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onPrev}
        disabled={currentSlide === 0}
        className="min-w-[100px]"
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        {t("learn.prevSlide")}
      </Button>

      {/* Slide dots */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalSlides }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-2 w-2 rounded-full transition-all duration-200",
              i === currentSlide
                ? "bg-primary scale-125"
                : "bg-muted-foreground/30"
            )}
          />
        ))}
      </div>

      {isLastSlide ? (
        <Button
          size="sm"
          onClick={onCompleteModule}
          className="min-w-[100px] animate-pulse-once"
          style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))" }}
        >
          {t("learn.completeModule")}
        </Button>
      ) : (
        <Button size="sm" onClick={onNext} className="min-w-[100px]">
          {t("learn.nextSlide")}
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export default SlideNavigation;
