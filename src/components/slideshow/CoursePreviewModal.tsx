import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import SlideView from "./SlideView";
import { useTranslation } from "react-i18next";

interface Slide {
  slide_number: number;
  title: string;
  bullets: string[];
  image_prompt?: string;
}

interface Module {
  id: string;
  module_number: number;
  title: string;
  content: string;
  key_points: string[];
  slides: Slide[] | null;
  image_url: string | null;
}

interface CoursePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modules: Module[];
  courseTitle: string;
}

const CoursePreviewModal = ({ open, onOpenChange, modules, courseTitle }: CoursePreviewModalProps) => {
  const { t } = useTranslation();
  const [currentModule, setCurrentModule] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);

  const mod = modules[currentModule];
  const slides = mod?.slides || [];
  const hasSlides = slides.length > 0;

  const fallbackSlide: Slide = mod
    ? {
        slide_number: 1,
        title: mod.title,
        bullets: mod.key_points?.length ? mod.key_points : mod.content.split("\n").filter(Boolean).slice(0, 5),
      }
    : { slide_number: 1, title: "", bullets: [] };

  const activeSlide = hasSlides ? slides[currentSlide] : fallbackSlide;
  const totalSlides = hasSlides ? slides.length : 1;

  const goNextSlide = () => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(currentSlide + 1);
    } else if (currentModule < modules.length - 1) {
      setCurrentModule(currentModule + 1);
      setCurrentSlide(0);
    }
  };

  const goPrevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    } else if (currentModule > 0) {
      setCurrentModule(currentModule - 1);
      const prevSlides = modules[currentModule - 1]?.slides || [];
      setCurrentSlide(prevSlides.length > 0 ? prevSlides.length - 1 : 0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center justify-between">
            <span>{courseTitle}</span>
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <span className="inline-block rounded-full bg-accent/20 px-3 py-1 text-xs font-medium text-accent-foreground">
              {t("learn.previewMode")}
            </span>
            <span className="text-muted-foreground text-xs">
              {t("learn.moduleOf", { current: currentModule + 1, total: modules.length })}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4">
          {mod && (
            <SlideView
              slide={activeSlide}
              imageUrl={mod.image_url}
              moduleTitle={mod.title}
              moduleNumber={mod.module_number}
              direction="none"
            />
          )}
        </div>

        <div className="flex items-center justify-between px-6 pb-6">
          <Button variant="outline" size="sm" onClick={goPrevSlide} disabled={currentModule === 0 && currentSlide === 0}>
            <ChevronLeft className="mr-1 h-4 w-4" /> {t("learn.prevSlide")}
          </Button>

          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSlides }).map((_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full transition-all ${i === currentSlide ? "bg-primary scale-125" : "bg-muted-foreground/30"}`}
              />
            ))}
          </div>

          <Button
            size="sm"
            onClick={goNextSlide}
            disabled={currentModule === modules.length - 1 && currentSlide === totalSlides - 1}
          >
            {t("learn.nextSlide")} <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CoursePreviewModal;
