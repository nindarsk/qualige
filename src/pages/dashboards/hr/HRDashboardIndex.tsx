import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, BookOpen, Award, BarChart3, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePageTitle } from "@/hooks/use-page-title";

interface DashStats {
  totalEmployees: number;
  coursesPublished: number;
  completionsThisMonth: number;
  avgQuizScore: number;
}

interface Activity {
  id: string;
  employee_name: string;
  course_title: string;
  action: string;
  date: string;
}

interface LeaderEntry {
  name: string;
  completed: number;
}

const HRDashboardIndex = () => {
  usePageTitle("Dashboard");
  const { organizationId } = useAuth();
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashStats>({ totalEmployees: 0, coursesPublished: 0, completionsThisMonth: 0, avgQuizScore: 0 });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (organizationId) fetchDashboardData();
  }, [organizationId]);

  const fetchDashboardData = async () => {
    try {
      const [empRes, courseRes, assignRes, quizRes] = await Promise.all([
        supabase.from("employees").select("id", { count: "exact", head: true }),
        supabase.from("courses").select("id", { count: "exact", head: true }).eq("status", "published"),
        supabase.from("course_assignments").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("quiz_attempts").select("score"),
      ]);

      const scores = (quizRes.data || []).map((q: any) => Number(q.score));
      const avgScore = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;

      setStats({
        totalEmployees: empRes.count || 0,
        coursesPublished: courseRes.count || 0,
        completionsThisMonth: assignRes.count || 0,
        avgQuizScore: Math.round(avgScore),
      });

      const { data: recentAttempts } = await supabase
        .from("quiz_attempts")
        .select("id, score, passed, attempted_at, employee_id, course_id")
        .order("attempted_at", { ascending: false })
        .limit(10);

      if (recentAttempts?.length) {
        const enrichedActivities: Activity[] = await Promise.all(
          recentAttempts.map(async (a: any) => {
            const [empRes, courseRes] = await Promise.all([
              supabase.from("employees").select("full_name").eq("id", a.employee_id).single(),
              supabase.from("courses").select("title").eq("id", a.course_id).single(),
            ]);
            return {
              id: a.id,
              employee_name: empRes.data?.full_name || "Unknown",
              course_title: courseRes.data?.title || "Unknown",
              action: a.passed ? "Completed" : "Failed",
              date: new Date(a.attempted_at).toLocaleDateString(),
            };
          })
        );
        setActivities(enrichedActivities);
      }

      const { data: completedAssignments } = await supabase
        .from("course_assignments")
        .select("employee_id")
        .eq("status", "completed");

      if (completedAssignments?.length) {
        const counts: Record<string, number> = {};
        completedAssignments.forEach((a: any) => {
          counts[a.employee_id] = (counts[a.employee_id] || 0) + 1;
        });

        const sorted = Object.entries(counts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);

        const leaderData: LeaderEntry[] = await Promise.all(
          sorted.map(async ([empId, count]) => {
            const { data: emp } = await supabase.from("employees").select("full_name").eq("id", empId).single();
            return { name: emp?.full_name || "Unknown", completed: count };
          })
        );
        setLeaders(leaderData);
      }
    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statCards = [
    { title: t("dashboard.totalEmployees"), value: stats.totalEmployees, icon: Users, color: "text-primary" },
    { title: t("dashboard.coursesPublished"), value: stats.coursesPublished, icon: BookOpen, color: "text-accent" },
    { title: t("dashboard.completions"), value: stats.completionsThisMonth, icon: Award, color: "text-primary" },
    { title: t("dashboard.avgQuizScore"), value: `${stats.avgQuizScore}%`, icon: BarChart3, color: "text-accent" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-foreground">{t("dashboard.title")}</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.title}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-muted ${s.color}`}>
                <s.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{s.title}</p>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.recentActivity")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {activities.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">{t("dashboard.noActivityYet")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("dashboard.employee")}</TableHead>
                    <TableHead>{t("dashboard.course")}</TableHead>
                    <TableHead>{t("dashboard.action")}</TableHead>
                    <TableHead>{t("dashboard.date")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.employee_name}</TableCell>
                      <TableCell className="text-muted-foreground">{a.course_title}</TableCell>
                      <TableCell>
                        <Badge variant={a.action === "Completed" ? "default" : "destructive"}>
                          {a.action === "Completed" ? t("dashboard.completed") : t("dashboard.failed")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-accent" /> {t("dashboard.leaderboard")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaders.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">{t("dashboard.noCompletionsYet")}</p>
            ) : (
              <div className="space-y-3">
                {leaders.map((l, idx) => (
                  <div key={l.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-foreground">{l.name}</span>
                    </div>
                    <Badge variant="outline">{l.completed} {t("dashboard.courses")}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HRDashboardIndex;
