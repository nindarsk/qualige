import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, ChevronRight, CheckCircle2, Circle, BookOpen, Loader2, ClipboardList,
} from "lucide-react";
import { logAuditEvent } from "@/lib/audit-log";
import { useTranslation } from "react-i18next";

interface Module {
  id: string;
  module_number: number;
  title: string;
  content: string;
  key_points: string[] | null;
}

const CourseLearnPage = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [modules, setModules] = useState<Module[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedModules, setCompletedModules] = useState<Set<string>>(new Set());
  const [courseTitle, setCourseTitle] = useState("");
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [progressId, setProgressId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (user && courseId) loadCourse();
  }, [user, courseId]);

  const loadCourse = async () => {
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("user_id", user!.id)
      .single();

    if (!emp) { setLoading(false); return; }
    setEmployeeId(emp.id);

    const { data: assign } = await supabase
      .from("course_assignments")
      .select("id")
      .eq("course_id", courseId!)
      .eq("employee_id", emp.id)
      .single();

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
    setModules(modulesRes.data || []);

    const { data: prog } = await supabase
      .from("course_progress")
      .select("*")
      .eq("assignment_id", assign.id)
      .maybeSingle();

    if (prog) {
      setProgressId(prog.id);
      setCompletedModules(new Set((prog.completed_modules as string[]) || []));
      const idx = Math.max(0, (prog.current_module || 1) - 1);
      setCurrentIndex(idx);
    } else {
      const { data: newProg } = await supabase
        .from("course_progress")
        .insert({
          assignment_id: assign.id,
          employee_id: emp.id,
          course_id: courseId!,
          current_module: 1,
          completed_modules: [],
        })
        .select()
        .single();

      if (newProg) setProgressId(newProg.id);

      await supabase
        .from("course_assignments")
        .update({ status: "in_progress" })
        .eq("id", assign.id);

      logAuditEvent({ action: "COURSE_STARTED", details: `Employee started: ${courseRes.data?.title || "Course"}` });
    }

    setLoading(false);
  };

  const saveProgress = useCallback(async (newCompleted: Set<string>, newIndex: number) => {
    if (!progressId) return;
    await supabase
      .from("course_progress")
      .update({
        current_module: newIndex + 1,
        completed_modules: Array.from(newCompleted),
      })
      .eq("id", progressId);
  }, [progressId]);

  const markCurrentComplete = useCallback(() => {
    if (!modules[currentIndex]) return;
    const id = modules[currentIndex].id;
    setCompletedModules((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, [currentIndex, modules]);

  const goToModule = (index: number) => {
    markCurrentComplete();
    const newCompleted = new Set(completedModules);
    if (modules[currentIndex]) newCompleted.add(modules[currentIndex].id);
    setCurrentIndex(index);
    saveProgress(newCompleted, index);
  };

  const goNext = () => {
    if (currentIndex < modules.length - 1) {
      goToModule(currentIndex + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      goToModule(currentIndex - 1);
    }
  };

  const isLastModule = currentIndex === modules.length - 1;
  const overallProgress = modules.length > 0
    ? Math.round(((completedModules.size + (completedModules.has(modules[currentIndex]?.id) ? 0 : 0)) / modules.length) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentModule = modules[currentIndex];

  return (
    <div className="fixed inset-0 z-50 flex bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex w-72 flex-col border-r border-border bg-card transition-all duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-72"
        )}
      >
        <div className="flex items-center gap-2 border-b border-border p-4">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-bold text-foreground truncate">{courseTitle}</h2>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {modules.map((mod, idx) => {
            const isComplete = completedModules.has(mod.id);
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={mod.id}
                onClick={() => goToModule(idx)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  isCurrent
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {isComplete ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0" />
                )}
                <span className="truncate">{mod.title}</span>
              </button>
            );
          })}
        </nav>
        <div className="border-t border-border p-4">
          <Button variant="outline" className="w-full" asChild>
            <Link to="/employee">{t("learn.backToDashboard")}</Link>
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Progress bar */}
        <div className="border-b border-border bg-card px-6 py-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
            <span>{t("learn.moduleOf", { current: currentIndex + 1, total: modules.length })}</span>
            <span>{t("learn.percentComplete", { percent: overallProgress })}</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-8 lg:px-16">
          {currentModule && (
            <div className="mx-auto max-w-3xl">
              <h1 className="mb-6 text-2xl font-bold text-foreground">{currentModule.title}</h1>
              <div className="prose prose-slate max-w-none text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {currentModule.content}
              </div>

              {currentModule.key_points && currentModule.key_points.length > 0 && (
                <div className="mt-8 rounded-lg border border-border bg-muted/50 p-6">
                  <h3 className="mb-3 font-semibold text-foreground">{t("learn.keyPoints")}</h3>
                  <ul className="space-y-2">
                    {currentModule.key_points.map((kp, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        {kp}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="border-t border-border bg-card px-6 py-4">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <Button
              variant="outline"
              onClick={goPrev}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="mr-2 h-4 w-4" /> {t("learn.previousModule")}
            </Button>

            {isLastModule ? (
              <Button
                onClick={() => {
                  markCurrentComplete();
                  const allComplete = new Set(completedModules);
                  if (currentModule) allComplete.add(currentModule.id);
                  saveProgress(allComplete, currentIndex);
                  navigate(`/employee/learn/${courseId}/quiz`);
                }}
              >
                <ClipboardList className="mr-2 h-4 w-4" /> {t("learn.takeQuiz")}
              </Button>
            ) : (
              <Button onClick={goNext}>
                {t("learn.nextModule")} <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseLearnPage;
