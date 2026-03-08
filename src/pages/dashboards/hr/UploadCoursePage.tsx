import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileText, X, BookOpen, Loader2, Sparkles, ClipboardCheck } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import AIGenerateCourseTab from "@/components/course-creation/AIGenerateCourseTab";
import AIGenerateQuizTab from "@/components/course-creation/AIGenerateQuizTab";

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".txt"];
const MAX_SIZE = 20 * 1024 * 1024;

const CATEGORIES = ["Compliance", "AML", "Customer Service", "Risk Management", "IT Security", "HR Policy", "Other"];
const LANGUAGES = ["English", "Georgian", "Russian"];

const LOADING_STEPS = [
  { key: "analyzing", progressEnd: 20 },
  { key: "identifying", progressEnd: 40 },
  { key: "structuring", progressEnd: 55 },
  { key: "creatingSlides", progressEnd: 70 },
  { key: "generatingImages", progressEnd: 90 },
  { key: "finalizing", progressEnd: 100 },
];

type TabId = "upload" | "ai-course" | "ai-quiz";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "upload", label: "Upload Document", icon: <Upload className="h-4 w-4" /> },
  { id: "ai-course", label: "AI Generate Course", icon: <Sparkles className="h-4 w-4" /> },
  { id: "ai-quiz", label: "AI Generate Quiz", icon: <ClipboardCheck className="h-4 w-4" /> },
];

const UploadCoursePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Support pre-selecting tab via navigation state (from templates page)
  const initialTab = (location.state as any)?.tab || "upload";
  const [activeTab, setActiveTab] = useState<TabId>(initialTab as TabId);

  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("Compliance");
  const [language, setLanguage] = useState("English");
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const validateFile = (f: File): boolean => {
    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      toast({ title: "Invalid file type", description: "Please upload PDF, DOCX, PPTX, or TXT files.", variant: "destructive" });
      return false;
    }
    if (f.size > MAX_SIZE) {
      toast({ title: "File too large", description: "Maximum file size is 20MB.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && validateFile(droppedFile)) setFile(droppedFile);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && validateFile(selected)) setFile(selected);
  };

  const handleGenerate = async () => {
    if (!file) {
      toast({ title: "No file", description: "Upload a file first.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setLoadingMsgIndex(0);

    const stepDuration = 8000;
    const msgInterval = setInterval(() => {
      setLoadingMsgIndex((prev) => Math.min(prev + 1, LOADING_STEPS.length - 1));
    }, stepDuration);

    const progressInterval = setInterval(() => {
      setLoadingMsgIndex((prevIdx) => {
        const target = LOADING_STEPS[Math.min(prevIdx, LOADING_STEPS.length - 1)].progressEnd;
        setProgress((prev) => Math.min(prev + 1, target - 5));
        return prevIdx;
      });
    }, 400);

    try {
      const ext = file.name.split(".").pop();
      const path = `${user!.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("course-materials").upload(path, file);
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const { data, error } = await supabase.functions.invoke("generate-course", {
        body: { filePath: path, category, language },
      });

      if (error) {
        const context = (error as any)?.context;
        let errorMsg = "Something went wrong.";
        if (context && typeof context === "object") {
          try {
            const body = context.body ? await new Response(context.body).json() : null;
            if (body?.error) errorMsg = body.error;
          } catch { /* ignore */ }
        }
        throw new Error(errorMsg);
      }
      if (data?.error) throw new Error(data.error);

      setProgress(100);
      toast({ title: "Course generated!", description: "Review your new course." });
      setTimeout(() => navigate(`/hr/courses/${data.courseId}/review`), 500);
    } catch (err: any) {
      console.error("Generation error:", err);
      toast({ title: "Generation failed", description: err.message || "Something went wrong.", variant: "destructive" });
    } finally {
      clearInterval(msgInterval);
      clearInterval(progressInterval);
      setIsGenerating(false);
    }
  };

  if (isGenerating) {
    const currentStep = LOADING_STEPS[loadingMsgIndex];
    const showLongMessage = progress > 30;
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-8 px-6 text-center">
          <BookOpen className="h-16 w-16 text-primary animate-pulse" />
          <h1 className="text-2xl font-bold text-foreground">Quali.ge</h1>
          <div className="w-full max-w-md">
            <Progress value={progress} className="h-3" />
          </div>
          <p className="text-lg text-muted-foreground animate-pulse">
            {t(`courses.loadingMessages.${currentStep.key}`)}
          </p>
          {showLongMessage && (
            <p className="text-sm text-muted-foreground/70">{t("courses.loadingMessages.takingLong")}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Create Content</h1>
        <p className="text-muted-foreground">Upload documents or use AI to generate training courses and quizzes.</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex rounded-lg border border-border bg-muted/30 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "upload" && (
        <div className="space-y-8">
          <Card>
            <CardContent className="p-6">
              {file ? (
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium text-foreground">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors",
                    isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  )}
                >
                  <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="mb-2 text-lg font-medium text-foreground">Drop your training material here</p>
                  <p className="mb-4 text-sm text-muted-foreground">PDF, DOCX, PPTX, or TXT — max 20MB</p>
                  <Button variant="outline" type="button">Browse files</Button>
                  <input ref={fileInputRef} type="file" accept={ACCEPTED_EXTENSIONS.join(",")} onChange={handleFileSelect} className="hidden" />
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Course Language</label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Course Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={!file}
            className="w-full h-12 text-base font-semibold"
          >
            Generate Course with AI
          </Button>
        </div>
      )}

      {activeTab === "ai-course" && <AIGenerateCourseTab />}
      {activeTab === "ai-quiz" && <AIGenerateQuizTab />}
    </div>
  );
};

export default UploadCoursePage;
