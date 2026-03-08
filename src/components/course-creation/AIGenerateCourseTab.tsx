import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Loader2, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";
import TopicCards, { TopicCard } from "./TopicCards";

const AUDIENCES = ["Junior Staff", "Mid-level Staff", "Senior Staff", "All Staff", "Management"];
const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];
const LANGUAGES = ["English", "Georgian", "Russian"];
const MODULE_COUNTS = [3, 4, 5, 6, 7, 8];
const QUIZ_COUNTS = [5, 10, 15, 20];

const LOADING_STEPS = [
  { key: "analyzing", progressEnd: 15 },
  { key: "identifying", progressEnd: 30 },
  { key: "structuring", progressEnd: 45 },
  { key: "creatingSlides", progressEnd: 60 },
  { key: "generatingImages", progressEnd: 80 },
  { key: "finalizing", progressEnd: 100 },
];

const AIGenerateCourseTab = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("All Staff");
  const [difficulty, setDifficulty] = useState("Intermediate");
  const [language, setLanguage] = useState("English");
  const [moduleCount, setModuleCount] = useState("5");
  const [quizCount, setQuizCount] = useState("10");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [georgianContext, setGeorgianContext] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const handleTopicSelect = (card: TopicCard) => {
    setSelectedTopic(card.id);
    setTopic(card.name);
    setAdditionalInstructions(card.defaultPrompt);
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast({ title: "Topic required", description: "Please enter a course topic.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setLoadingMsgIndex(0);

    const stepDuration = 10000;
    const msgInterval = setInterval(() => {
      setLoadingMsgIndex((prev) => Math.min(prev + 1, LOADING_STEPS.length - 1));
    }, stepDuration);

    const progressInterval = setInterval(() => {
      setLoadingMsgIndex((prevIdx) => {
        const target = LOADING_STEPS[Math.min(prevIdx, LOADING_STEPS.length - 1)].progressEnd;
        setProgress((prev) => Math.min(prev + 1, target - 5));
        return prevIdx;
      });
    }, 500);

    try {
      const { data, error } = await supabase.functions.invoke("generate-course", {
        body: {
          mode: "ai_prompt",
          topic: topic.trim(),
          targetAudience: audience,
          difficulty,
          language,
          moduleCount: parseInt(moduleCount),
          quizCount: parseInt(quizCount),
          additionalInstructions: additionalInstructions.trim() || null,
          georgianContext,
        },
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
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-8 px-6 text-center">
          <Sparkles className="h-16 w-16 text-accent animate-pulse" />
          <h1 className="text-2xl font-bold text-foreground">Generating Course with AI</h1>
          <div className="w-full max-w-md">
            <Progress value={progress} className="h-3" />
          </div>
          <p className="text-lg text-muted-foreground animate-pulse">
            {t(`courses.loadingMessages.${currentStep.key}`)}
          </p>
          {progress > 30 && (
            <p className="text-sm text-muted-foreground/70">{t("courses.loadingMessages.takingLong")}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Topic Selector */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Quick Topic Selector</h3>
        <TopicCards selectedTopic={selectedTopic} onSelectTopic={handleTopicSelect} />
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">Topic *</label>
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What should this course be about?"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Target Audience *</label>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AUDIENCES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Difficulty Level</label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
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
            <label className="mb-2 block text-sm font-medium text-foreground">Number of Modules</label>
            <Select value={moduleCount} onValueChange={setModuleCount}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODULE_COUNTS.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Quiz Questions</label>
            <Select value={quizCount} onValueChange={setQuizCount}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {QUIZ_COUNTS.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">Additional Instructions (optional)</label>
          <Textarea
            value={additionalInstructions}
            onChange={(e) => setAdditionalInstructions(e.target.value)}
            placeholder="Any specific topics to include or avoid, local regulations to reference, etc."
            rows={3}
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="georgian-context"
            checked={georgianContext}
            onCheckedChange={(checked) => setGeorgianContext(checked === true)}
          />
          <label htmlFor="georgian-context" className="text-sm text-foreground cursor-pointer">
            Tailor content for Georgian banking regulations and National Bank of Georgia requirements
          </label>
        </div>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={!topic.trim()}
        className="w-full h-12 text-base font-semibold"
      >
        <Sparkles className="mr-2 h-5 w-5" />
        Generate Course with AI
      </Button>
    </div>
  );
};

export default AIGenerateCourseTab;
