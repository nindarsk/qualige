import { cn } from "@/lib/utils";

interface Slide {
  slide_number: number;
  title: string;
  bullets: string[];
  image_prompt?: string;
}

interface SlideViewProps {
  slide: Slide;
  imageUrl: string | null;
  moduleTitle: string;
  moduleNumber: number;
  direction: "left" | "right" | "none";
}

const SlideView = ({ slide, imageUrl, moduleTitle, moduleNumber, direction }: SlideViewProps) => {
  return (
    <div
      className={cn(
        "w-full rounded-xl border border-border bg-card shadow-lg overflow-hidden transition-all duration-300",
        direction === "left" && "animate-slide-in-left",
        direction === "right" && "animate-slide-in-right",
        direction === "none" && "animate-fade-in"
      )}
    >
      {/* Image area */}
      <div className="relative w-full h-[180px] sm:h-[280px] overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={moduleTitle}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.7) 50%, hsl(var(--accent)) 100%)",
            }}
          >
            <span className="text-6xl sm:text-8xl font-bold text-primary-foreground/20">
              {moduleNumber}
            </span>
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="p-6 sm:p-8 space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
            {moduleTitle}
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            {slide.title}
          </h2>
        </div>

        <ul className="space-y-3">
          {slide.bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-3 text-foreground/80">
              <span
                className="mt-2 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: "hsl(var(--accent))" }}
              />
              <span className="text-sm sm:text-base leading-relaxed">{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default SlideView;
