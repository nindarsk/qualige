import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { generateAndUploadCertificate } from "@/lib/generate-certificate-pdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Award, RotateCcw, Home, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnswerDetail {
  question_id: string;
  question: string;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  explanation: string | null;
}

const QuizResultsPage = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const state = location.state as {
    score: number;
    passed: boolean;
    answers: AnswerDetail[];
    total: number;
    correct: number;
  } | null;

  // Auto-generate certificate on pass
  useEffect(() => {
    if (state?.passed && courseId && user) {
      setGenerating(true);
      generateAndUploadCertificate(courseId, user.id, state.score)
        .then((result) => {
          if (result?.pdfUrl) setPdfUrl(result.pdfUrl);
        })
        .catch(console.error)
        .finally(() => setGenerating(false));
    }
  }, [state?.passed, courseId, user]);

  if (!state) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">No quiz results found.</p>
        <Button asChild><Link to="/employee">Back to Dashboard</Link></Button>
      </div>
    );
  }

  const { score, passed, answers, total, correct } = state;

  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-2xl space-y-8">
        {/* Score Card */}
        <Card className="text-center">
          <CardContent className="py-10">
            <div
              className={cn(
                "mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-full text-4xl font-bold",
                passed
                  ? "bg-primary/10 text-primary"
                  : "bg-destructive/10 text-destructive"
              )}
            >
              {Math.round(score)}%
            </div>
            <Badge
              className={cn(
                "mb-3 text-sm px-4 py-1",
                passed ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground"
              )}
            >
              {passed ? "PASSED" : "FAILED"}
            </Badge>
            <p className="text-lg font-semibold text-foreground">
              {passed ? "Congratulations! You passed." : "Good effort! You need 70% to pass."}
            </p>
            <p className="mt-1 text-muted-foreground">
              {correct} out of {total} questions correct
            </p>

            <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
              {passed && pdfUrl && (
                <Button onClick={() => window.open(pdfUrl, "_blank")}>
                  <Download className="mr-2 h-4 w-4" /> Download Certificate
                </Button>
              )}
              {passed && generating && (
                <Button disabled>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Certificate...
                </Button>
              )}
              {passed && !generating && !pdfUrl && (
                <Button asChild>
                  <Link to="/employee/certificates">
                    <Award className="mr-2 h-4 w-4" /> View Certificates
                  </Link>
                </Button>
              )}
              {!passed && (
                <Button onClick={() => navigate(`/employee/learn/${courseId}/quiz`, { replace: true })}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Retake Quiz
                </Button>
              )}
              <Button variant="outline" asChild>
                <Link to="/employee">
                  <Home className="mr-2 h-4 w-4" /> Dashboard
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Answer Breakdown */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Question Breakdown</h2>
          {answers.map((a, idx) => (
            <Card key={a.question_id} className={cn(
              "border-l-4",
              a.is_correct ? "border-l-primary" : "border-l-destructive"
            )}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  {a.is_correct ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {idx + 1}. {a.question}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Your answer: <span className={a.is_correct ? "text-primary font-medium" : "text-destructive font-medium"}>{a.user_answer || "Not answered"}</span>
                    </p>
                    {!a.is_correct && (
                      <p className="text-sm text-muted-foreground">
                        Correct answer: <span className="text-primary font-medium">{a.correct_answer}</span>
                      </p>
                    )}
                    {a.explanation && (
                      <p className="mt-2 text-sm text-muted-foreground italic">{a.explanation}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuizResultsPage;
