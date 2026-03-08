import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { generateAndUploadCertificate } from "@/lib/generate-certificate-pdf";
import { downloadCertificate } from "@/lib/download-certificate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Award, RotateCcw, Home, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { logAuditEvent } from "@/lib/audit-log";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const [generating, setGenerating] = useState(false);
  const [certId, setCertId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const state = location.state as {
    score: number;
    passed: boolean;
    answers: AnswerDetail[];
    total: number;
    correct: number;
  } | null;

  useEffect(() => {
    if (state?.passed && courseId && user) {
      setGenerating(true);
      generateAndUploadCertificate(courseId, user.id, state.score)
        .then((result) => {
          if (result?.certificateId) setCertId(result.certificateId);
        })
        .catch(console.error)
        .finally(() => setGenerating(false));
    }
  }, [state?.passed, courseId, user]);

  if (!state) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">{t("quiz.noResults")}</p>
        <Button asChild><Link to="/employee">{t("quiz.backToDashboard")}</Link></Button>
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
              {passed ? t("quiz.passed") : t("quiz.failed")}
            </Badge>
            <p className="text-lg font-semibold text-foreground">
              {passed ? t("quiz.congratsPassed") : t("quiz.needToPass")}
            </p>
            <p className="mt-1 text-muted-foreground">
              {t("quiz.questionsCorrect", { correct, total })}
            </p>

            <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
              {passed && certId && (
                <Button
                  disabled={downloading}
                  onClick={async () => {
                    if (!user) return;
                    setDownloading(true);
                    try {
                      await downloadCertificate(certId, user.id);
                      logAuditEvent({ action: "CERTIFICATE_DOWNLOADED", details: `Certificate: ${certId}` });
                    } catch { alert(t("certificates.downloadFailed")); }
                    finally { setDownloading(false); }
                  }}
                >
                  {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  {downloading ? t("quiz.downloading") : t("quiz.downloadCertificate")}
                </Button>
              )}
              {passed && generating && (
                <Button disabled>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("quiz.generatingCertificate")}
                </Button>
              )}
              {passed && !generating && !certId && (
                <Button asChild>
                  <Link to="/employee/certificates">
                    <Award className="mr-2 h-4 w-4" /> {t("quiz.viewCertificates")}
                  </Link>
                </Button>
              )}
              {!passed && (
                <Button onClick={() => navigate(`/employee/learn/${courseId}/quiz`, { replace: true })}>
                  <RotateCcw className="mr-2 h-4 w-4" /> {t("quiz.retakeQuiz")}
                </Button>
              )}
              <Button variant="outline" asChild>
                <Link to="/employee">
                  <Home className="mr-2 h-4 w-4" /> {t("nav.dashboard")}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Answer Breakdown */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-foreground">{t("quiz.questionBreakdown")}</h2>
          {answers.map((a, idx) => (
            <Card key={a.question_id} className={cn(
              "border-l-4",
              a.is_correct ? "border-l-primary" : "border-l-destructive"
            )}>
              <CardContent className="py-5">
                <div className="flex items-start gap-3 mb-4">
                  {a.is_correct ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                  )}
                  <p className="font-medium text-foreground">
                    {idx + 1}. {a.question}
                  </p>
                </div>

                <div className="ml-8 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {t("quiz.yourAnswer")}: <span className={a.is_correct ? "text-primary font-medium" : "text-destructive font-medium"}>{a.user_answer || t("quiz.notAnswered")}</span>
                  </p>
                  {!a.is_correct && (
                    <p className="text-sm text-muted-foreground">
                      {t("quiz.correctAnswer")}: <span className="text-primary font-medium">{a.correct_answer}</span>
                    </p>
                  )}
                  {a.explanation && (
                    <p className="mt-2 text-sm text-muted-foreground italic">{a.explanation}</p>
                  )}
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
