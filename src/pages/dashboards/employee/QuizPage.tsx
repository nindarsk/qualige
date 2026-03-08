import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Loader2, ChevronRight, CheckCircle2, Send } from "lucide-react";
import { logAuditEvent } from "@/lib/audit-log";

interface Question {
  id: string;
  question_number: number;
  question: string;
  options: string[];
}

const QuizPage = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && courseId) loadQuiz();
  }, [user, courseId]);

  const loadQuiz = async () => {
    // Use the safe view that excludes correct_answer and explanation
    const { data } = await supabase
      .from("quiz_questions_safe" as any)
      .select("id, question_number, question, options")
      .eq("course_id", courseId!)
      .order("question_number");

    setQuestions(data || []);
    setLoading(false);
  };

  const selectAnswer = (option: string) => {
    setSelectedAnswer(option);
    setAnswers((prev) => ({
      ...prev,
      [questions[currentQ].id]: option,
    }));
  };

  const goNext = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ((p) => p + 1);
      setSelectedAnswer(answers[questions[currentQ + 1]?.id] || null);
    }
  };

  const submitQuiz = async () => {
    setSubmitting(true);

    try {
      // Submit answers to server-side grading function
      const { data: result, error } = await supabase.functions.invoke("grade-quiz", {
        body: { courseId, answers },
      });

      if (error || !result) {
        toast({ title: "Failed to submit quiz", description: error?.message || "Please try again.", variant: "destructive" });
        setSubmitting(false);
        return;
      }

      const { score, passed, correct, total, answers: answerDetails } = result;

      // Get course title for audit log
      const { data: courseData } = await supabase.from("courses").select("title").eq("id", courseId!).single();
      const courseTitle = courseData?.title || "Course";

      // Audit log
      if (passed) {
        logAuditEvent({ action: "QUIZ_PASSED", details: `Score: ${Math.round(score)}% on ${courseTitle}` });
        logAuditEvent({ action: "COURSE_COMPLETED", details: `Employee completed: ${courseTitle}` });
      } else {
        logAuditEvent({ action: "QUIZ_FAILED", details: `Score: ${Math.round(score)}% on ${courseTitle}` });
      }

      // Completion email is now sent server-side by the grade-quiz function

      navigate(`/employee/learn/${courseId}/results`, {
        state: { score, passed, answers: answerDetails, total, correct },
      });
    } catch (err) {
      console.error("Quiz submit error:", err);
      toast({ title: "Failed to submit quiz", description: "Please try again.", variant: "destructive" });
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-muted-foreground">No quiz questions available for this course.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/employee")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const q = questions[currentQ];
  const isLast = currentQ === questions.length - 1;
  const progressPct = ((currentQ + 1) / questions.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Progress */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
            <span>Question {currentQ + 1} of {questions.length}</span>
            <span>{Math.round(progressPct)}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <h2 className="text-xl font-bold text-foreground">{q.question}</h2>

          <div className="grid gap-3">
            {q.options.map((option, idx) => (
              <Card
                key={idx}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  selectedAnswer === option
                    ? "border-primary bg-primary/5 ring-2 ring-primary"
                    : "hover:border-primary/50"
                )}
                onClick={() => selectAnswer(option)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
                      selectedAnswer === option
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground"
                    )}
                  >
                    {String.fromCharCode(65 + idx)}
                  </div>
                  <span className="text-foreground">{option}</span>
                  {selectedAnswer === option && (
                    <CheckCircle2 className="ml-auto h-5 w-5 text-primary" />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="border-t border-border bg-card px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Button
            variant="outline"
            onClick={() => {
              setCurrentQ((p) => p - 1);
              setSelectedAnswer(answers[questions[currentQ - 1]?.id] || null);
            }}
            disabled={currentQ === 0}
          >
            Previous
          </Button>

          {isLast ? (
            <Button
              onClick={submitQuiz}
              disabled={!selectedAnswer || submitting}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Submit Quiz
            </Button>
          ) : (
            <Button onClick={goNext} disabled={!selectedAnswer}>
              Next Question <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizPage;
