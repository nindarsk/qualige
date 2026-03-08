import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import TopicCards, { TopicCard } from "./TopicCards";

const AUDIENCES = ["Junior Staff", "Mid-level Staff", "Senior Staff", "All Staff", "Management"];
const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];
const LANGUAGES = ["English", "Georgian", "Russian"];
const QUESTION_COUNTS = [5, 10, 15, 20, 25];
const PASSING_SCORES = [60, 70, 75, 80];

const LOADING_STEPS = [
  { key: "analyzing", label: "Preparing quiz framework...", progressEnd: 25 },
  { key: "identifying", label: "Crafting questions...", progressEnd: 50 },
  { key: "structuring", label: "Generating answer options...", progressEnd: 75 },
  { key: "finalizing", label: "Finalizing assessment...", progressEnd: 100 },
];

const AIGenerateQuizTab = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [quizTitle, setQuizTitle] = useState("");
  const [audience, setAudience] = useState("All Staff");
  const [difficulty, setDifficulty] = useState("Intermediate");
  const [language, setLanguage] = useState("English");
  const [questionCount, setQuestionCount] = useState("10");
  const [passingScore, setPassingScore] = useState("70");
  const [includeMultipleChoice, setIncludeMultipleChoice] = useState(true);
  const [includeTrueFalse, setIncludeTrueFalse] = useState(false);
  const [includeScenario, setIncludeScenario] = useState(false);
  const [georgianContext, setGeorgianContext] = useState(true);
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const handleTopicSelect = (card: TopicCard) => {
    setSelectedTopic(card.id);
    setTopic(card.name);
    if (!quizTitle) setQuizTitle(`${card.name} Assessment`);
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast({ title: "Topic required", description: "Please enter a quiz topic.", variant: "destructive" });
      return;
    }
    if (!quizTitle.trim()) {
      toast({ title: "Title required", description: "Please enter a quiz title.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setLoadingMsgIndex(0);

    const stepDuration = 6000;
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
      const { data, error } = await supabase.functions.invoke("generate-course", {
        body: {
          mode: "ai_quiz_only",
          topic: topic.trim(),
          quizTitle: quizTitle.trim(),
          targetAudience: audience,
          difficulty,
          language,
          questionCount: parseInt(questionCount),
          passingScore: parseInt(passingScore),
          includeTrueFalse,
          includeScenarios: includeScenario,
          georgianContext,
          additionalInstructions: additionalInstructions.trim() || null,
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
      toast({ title: "Quiz generated!", description: "Review your new quiz." });
      setTimeout(() => navigate(`/hr/courses/${data.courseId}/review`), 500);
    } catch (err: any) {
      console.error("Quiz generation error:", err);
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
          <ClipboardCheck className="h-16 w-16 text-accent animate-pulse" />
          <h1 className="text-2xl font-bold text-foreground">Generating Quiz with AI</h1>
          <div className="w-full max-w-md">
            <Progress value={progress} className="h-3" />
          </div>
          <p className="text-lg text-muted-foreground animate-pulse">{currentStep.label}</p>
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Topic *</label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What should this quiz assess?"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Quiz Title *</label>
            <Input
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              placeholder="What employees will see"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Target Audience</label>
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
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Quiz Language</label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Number of Questions</label>
            <Select value={questionCount} onValueChange={setQuestionCount}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {QUESTION_COUNTS.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Passing Score</label>
            <Select value={passingScore} onValueChange={setPassingScore}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PASSING_SCORES.map((s) => <SelectItem key={s} value={String(s)}>{s}%</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Question Types */}
        <div>
          <label className="mb-3 block text-sm font-medium text-foreground">Question Types</label>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Checkbox id="mc" checked={includeMultipleChoice} disabled />
              <label htmlFor="mc" className="text-sm text-foreground">Multiple choice (4 options)</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="tf" checked={includeTrueFalse} onCheckedChange={(c) => setIncludeTrueFalse(c === true)} />
              <label htmlFor="tf" className="text-sm text-foreground cursor-pointer">True or False</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="scenario" checked={includeScenario} onCheckedChange={(c) => setIncludeScenario(c === true)} />
              <label htmlFor="scenario" className="text-sm text-foreground cursor-pointer">Scenario-based questions</label>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="georgian-ctx-quiz"
            checked={georgianContext}
            onCheckedChange={(checked) => setGeorgianContext(checked === true)}
          />
          <label htmlFor="georgian-ctx-quiz" className="text-sm text-foreground cursor-pointer">
            Tailor content for Georgian banking regulations and National Bank of Georgia requirements
          </label>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">Additional Instructions (optional)</label>
          <Textarea
            value={additionalInstructions}
            onChange={(e) => setAdditionalInstructions(e.target.value)}
            placeholder="Any specific areas to focus on, regulations to reference, etc."
            rows={3}
          />
        </div>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={!topic.trim() || !quizTitle.trim()}
        className="w-full h-12 text-base font-semibold"
      >
        <ClipboardCheck className="mr-2 h-5 w-5" />
        Generate Quiz with AI
      </Button>
    </div>
  );
};

export default AIGenerateQuizTab;
