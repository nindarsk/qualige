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
  correct_answer: string;
  explanation: string | null;
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
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    if (user && courseId) loadQuiz();
  }, [user, courseId]);

  const loadQuiz = async () => {
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("user_id", user!.id)
      .single();

    if (emp) setEmployeeId(emp.id);

    const { data } = await supabase
      .from("quiz_questions")
      .select("*")
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
    if (!employeeId) return;
    setSubmitting(true);

    // Calculate score — normalize answers to compare first letter (A/B/C/D)
    const normalize = (answer: string) => answer?.toString().trim().charAt(0).toUpperCase();
    let correct = 0;
    const answerDetails = questions.map((q) => {
      const userAnswer = answers[q.id] || "";
      const isCorrect = normalize(userAnswer) === normalize(q.correct_answer);
      if (isCorrect) correct++;
      console.log(`[Quiz] Q${q.question_number}: selected="${userAnswer}" (${normalize(userAnswer)}), correct="${q.correct_answer}" (${normalize(q.correct_answer)}), match=${isCorrect}`);
      return {
        question_id: q.id,
        question: q.question,
        user_answer: userAnswer,
        correct_answer: q.correct_answer,
        is_correct: isCorrect,
        explanation: q.explanation,
      };
    });

    const score = questions.length > 0 ? (correct / questions.length) * 100 : 0;
    const passed = score >= 70;

    // Save attempt
    const { error } = await supabase.from("quiz_attempts").insert({
      course_id: courseId!,
      employee_id: employeeId,
      score,
      passed,
      answers: answerDetails,
    });

    if (error) {
      toast({ title: "Failed to save quiz", description: error.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    // If passed, update assignment status
    if (passed) {
      const { data: assign } = await supabase
        .from("course_assignments")
        .select("id")
        .eq("course_id", courseId!)
        .eq("employee_id", employeeId)
        .single();

      if (assign) {
        await supabase
          .from("course_assignments")
          .update({ status: "completed" })
          .eq("id", assign.id);

        await supabase
          .from("course_progress")
          .update({ completed_at: new Date().toISOString() })
          .eq("assignment_id", assign.id);
      }
    }

    // Get course title for audit log and email
    const { data: courseData } = await supabase.from("courses").select("title").eq("id", courseId!).single();
    const courseTitle = courseData?.title || "Course";

    // Audit log
    if (passed) {
      logAuditEvent({ action: "QUIZ_PASSED", details: `Score: ${Math.round(score)}% on ${courseTitle}` });
      logAuditEvent({ action: "COURSE_COMPLETED", details: `Employee completed: ${courseTitle}` });
    } else {
      logAuditEvent({ action: "QUIZ_FAILED", details: `Score: ${Math.round(score)}% on ${courseTitle}` });
    }

    // Send completion email if passed
    if (passed) {
      try {
        const { data: emp } = await supabase.from("employees").select("email, full_name, organization_id").eq("user_id", user!.id).single();
        if (emp) {
          // Send congrats to employee
          supabase.functions.invoke("send-email", {
            body: {
              to: emp.email,
              subject: `Congratulations! You completed ${courseTitle}`,
              html_body: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: #1B3A6B; padding: 24px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">Quali.ge</h1>
                    <div style="height: 3px; background: #C9A84C; margin-top: 12px;"></div>
                  </div>
                  <div style="padding: 32px; background: white;">
                    <h2 style="color: #1B3A6B;">Congratulations, ${emp.full_name}! 🎓</h2>
                    <p>You have successfully completed the training course:</p>
                    <p style="font-size: 18px; font-weight: bold; color: #1B3A6B;">${courseTitle}</p>
                    <p>Your score: <strong>${Math.round(score)}%</strong></p>
                    <p>Log in to Quali.ge to download your certificate.</p>
                    <a href="https://qualige.lovable.app/employee/certificates" style="display: inline-block; background: #1B3A6B; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; margin-top: 16px;">Download Certificate</a>
                  </div>
                  <div style="background: #1B3A6B; padding: 16px; text-align: center;">
                    <p style="color: rgba(255,255,255,0.6); font-size: 12px; margin: 0;">Quali.ge — AI-powered Learning Management System</p>
                  </div>
                </div>`,
            },
          }).catch(console.error);

          // Notify HR admin(s) — get profiles with hr_admin role in same org
          const { data: hrProfiles } = await supabase
            .from("profiles")
            .select("user_id, full_name")
            .eq("organization_id", emp.organization_id);

          if (hrProfiles) {
            for (const hr of hrProfiles) {
              const { data: roleCheck } = await supabase.from("user_roles").select("role").eq("user_id", hr.user_id).eq("role", "hr_admin").maybeSingle();
              if (roleCheck) {
                const { data: { user: hrUser } } = await supabase.auth.admin?.getUserById?.(hr.user_id) || { data: { user: null } };
                // We can't access auth.admin from client, so use profiles + auth email from metadata
                // Instead, log notification - HR will see in audit log
              }
            }
          }
        }
      } catch (emailErr) {
        console.error("Completion email error:", emailErr);
      }
    }

    navigate(`/employee/learn/${courseId}/results`, {
      state: { score, passed, answers: answerDetails, total: questions.length, correct },
    });
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
