import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ClipboardList, Loader2 } from "lucide-react";
import { logAuditEvent } from "@/lib/audit-log";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import SlideView from "@/components/slideshow/SlideView";
import SlideNavigation from "@/components/slideshow/SlideNavigation";
import ModuleSidebar from "@/components/slideshow/ModuleSidebar";
import { usePageTitle } from "@/hooks/use-page-title";

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
  key_points: string[] | null;
  slides: Slide[] | null;
  image_url: string | null;
}

const CourseLearnPage = () => {
  usePageTitle();
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const [modules, setModules] = useState<Module[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [completedModules, setCompletedModules] = useState<Set<string>>(new Set());
  const [courseTitle, setCourseTitle] = useState("");
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [progressId, setProgressId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | "none">("none");
  const [hasReachedLastSlide, setHasReachedLastSlide] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  // Swipe detection
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const currentModule = modules[currentIndex];
  const slides = currentModule?.slides || [];
  const hasSlides = slides.length > 0;
  const totalSlides = hasSlides ? slides.length : 1;

  useEffect(() => {
    if (user && courseId) loadCourse();
  }, [user, courseId]);

  // Track when user reaches last slide
  useEffect(() => {
    if (currentSlide >= totalSlides - 1) {
      setHasReachedLastSlide(true);
    }
  }, [currentSlide, totalSlides]);

  // Reset slide state when changing modules
  useEffect(() => {
    setHasReachedLastSlide(false);
  }, [currentIndex]);

  const loadCourse = async () => {
    const { data: emp } = await supabase.from("employees").select("id").eq("user_id", user!.id).single();
    if (!emp) { setLoading(false); return; }
    setEmployeeId(emp.id);

    const { data: assign } = await supabase.from("course_assignments").select("id").eq("course_id", courseId!).eq("employee_id", emp.id).single();
    if (!assign) {
      toast({ title: t("learn.courseNotAssigned"), variant: "destructive" });
      navigate("/employee");
      return;
    }
    setAssignmentId(assign.id);

    const [courseRes, modulesRes] = await Promise.all([
      supabase.from("courses").select("title").eq("id", courseId!).single(),
      supabase.from("course_modules").select("*").eq("course_id", courseId!).order("module_number"),
    ]);

    setCourseTitle(courseRes.data?.title || "");
    const mods = (modulesRes.data || []).map((m: any) => ({
      ...m,
      slides: m.slides || null,
      image_url: m.image_url || null,
    }));
    setModules(mods);

    const { data: prog } = await supabase.from("course_progress").select("*").eq("assignment_id", assign.id).maybeSingle();

    if (prog) {
      setProgressId(prog.id);
      setCompletedModules(new Set((prog.completed_modules as string[]) || []));
      const idx = Math.max(0, (prog.current_module || 1) - 1);
      setCurrentIndex(idx);
      const savedSlide = (prog as any).current_slide || 0;
      setCurrentSlide(savedSlide);
      if (idx > 0 || savedSlide > 0) {
        setIsResuming(true);
        setTimeout(() => setIsResuming(false), 3000);
      }
    } else {
      const { data: newProg } = await supabase.from("course_progress").insert({
        assignment_id: assign.id,
        employee_id: emp.id,
        course_id: courseId!,
        current_module: 1,
        completed_modules: [],
        current_slide: 0,
      } as any).select().single();

      if (newProg) setProgressId(newProg.id);
      await supabase.from("course_assignments").update({ status: "in_progress" }).eq("id", assign.id);
      logAuditEvent({ action: "COURSE_STARTED", details: `Employee started: ${courseRes.data?.title || "Course"}` });
    }

    setLoading(false);
  };

  const saveProgress = useCallback(async (newCompleted: Set<string>, newIndex: number, slideNum: number) => {
    if (!progressId) return;
    await supabase.from("course_progress").update({
      current_module: newIndex + 1,
      completed_modules: Array.from(newCompleted),
      current_slide: slideNum,
    } as any).eq("id", progressId);
  }, [progressId]);

  const goToSlide = (slideIdx: number) => {
    if (slideIdx < 0 || slideIdx >= totalSlides) return;
    setSlideDirection(slideIdx > currentSlide ? "left" : "right");
    setCurrentSlide(slideIdx);
    saveProgress(completedModules, currentIndex, slideIdx);
  };

  const markAndGoModule = (index: number) => {
    if (index < 0 || index >= modules.length) return;
    const newCompleted = new Set(completedModules);
    if (currentModule) newCompleted.add(currentModule.id);
    setCompletedModules(newCompleted);
    setSlideDirection(index > currentIndex ? "left" : "right");
    setCurrentIndex(index);
    setCurrentSlide(0);
    setHasReachedLastSlide(false);
    saveProgress(newCompleted, index, 0);
  };

  const canGoNextModule = hasReachedLastSlide || completedModules.has(currentModule?.id);

  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.changedTouches[0].screenX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].screenX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentSlide < totalSlides - 1) goToSlide(currentSlide + 1);
      else if (diff < 0 && currentSlide > 0) goToSlide(currentSlide - 1);
    }
  };

  const isLastModule = currentIndex === modules.length - 1;
  const overallProgress = modules.length > 0 ? Math.round((completedModules.size / modules.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Fallback slide for modules without slides data
  const fallbackSlide: Slide = currentModule
    ? {
        slide_number: 1,
        title: currentModule.title,
        bullets: currentModule.key_points?.length
          ? currentModule.key_points
          : currentModule.content.split("\n").filter(Boolean).slice(0, 5),
      }
    : { slide_number: 1, title: "", bullets: [] };

  const activeSlide = hasSlides ? slides[currentSlide] : fallbackSlide;

  return (
    <div className="fixed inset-0 z-50 flex flex-col sm:flex-row bg-background">
      {/* Sidebar / Mobile dropdown */}
      {!isMobile && (
        <ModuleSidebar
          modules={modules}
          currentIndex={currentIndex}
          completedModules={completedModules}
          courseTitle={courseTitle}
          onSelectModule={markAndGoModule}
          isMobile={false}
          t={t}
        />
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile module selector */}
        {isMobile && (
          <ModuleSidebar
            modules={modules}
            currentIndex={currentIndex}
            completedModules={completedModules}
            courseTitle={courseTitle}
            onSelectModule={markAndGoModule}
            isMobile={true}
            t={t}
          />
        )}

        {/* Top bar */}
        <div className="border-b border-border bg-card px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
            <span className="font-medium text-foreground truncate mr-4">{courseTitle}</span>
            <span className="shrink-0">
              {t("learn.moduleOf", { current: currentIndex + 1, total: modules.length })}
            </span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>

        {/* Resume toast */}
        {isResuming && (
          <div className="mx-4 sm:mx-6 mt-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-sm text-primary animate-fade-in">
            {t("learn.welcomeBack")}
          </div>
        )}

        {/* Slide content */}
        <div
          className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-16 py-6"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {currentModule && (
            <div className="mx-auto max-w-3xl">
              <SlideView
                slide={activeSlide}
                imageUrl={currentModule.image_url}
                moduleTitle={currentModule.title}
                moduleNumber={currentModule.module_number}
                direction={slideDirection}
              />
            </div>
          )}
        </div>

        {/* Slide navigation */}
        {hasSlides && (
          <div className="border-t border-border bg-card px-4 sm:px-6 py-3">
            <div className="mx-auto max-w-3xl">
              <SlideNavigation
                currentSlide={currentSlide}
                totalSlides={totalSlides}
                onPrev={() => goToSlide(currentSlide - 1)}
                onNext={() => goToSlide(currentSlide + 1)}
                isLastSlide={currentSlide === totalSlides - 1}
                onCompleteModule={() => {
                  setHasReachedLastSlide(true);
                  if (!isLastModule) markAndGoModule(currentIndex + 1);
                  else {
                    const newCompleted = new Set(completedModules);
                    if (currentModule) newCompleted.add(currentModule.id);
                    setCompletedModules(newCompleted);
                    saveProgress(newCompleted, currentIndex, currentSlide);
                    navigate(`/employee/learn/${courseId}/quiz`);
                  }
                }}
                t={t}
              />
            </div>
          </div>
        )}

        {/* Module navigation */}
        <div className="border-t border-border bg-card px-4 sm:px-6 py-4">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <Button variant="outline" onClick={() => markAndGoModule(currentIndex - 1)} disabled={currentIndex === 0}>
              <ChevronLeft className="mr-2 h-4 w-4" /> {t("learn.previousModule")}
            </Button>

            {isLastModule ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        onClick={() => {
                          const newCompleted = new Set(completedModules);
                          if (currentModule) newCompleted.add(currentModule.id);
                          saveProgress(newCompleted, currentIndex, currentSlide);
                          navigate(`/employee/learn/${courseId}/quiz`);
                        }}
                        disabled={!canGoNextModule}
                      >
                        <ClipboardList className="mr-2 h-4 w-4" /> {t("learn.takeQuiz")}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!canGoNextModule && (
                    <TooltipContent>
                      <p>{t("learn.completeAllSlides")}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button onClick={() => markAndGoModule(currentIndex + 1)} disabled={!canGoNextModule}>
                        {t("learn.nextModule")} <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!canGoNextModule && (
                    <TooltipContent>
                      <p>{t("learn.completeAllSlides")}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseLearnPage;
