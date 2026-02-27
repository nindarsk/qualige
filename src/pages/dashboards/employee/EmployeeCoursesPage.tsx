import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, BookOpen, Award, Calendar, PlayCircle } from "lucide-react";

interface Assignment {
  id: string;
  course_id: string;
  status: string;
  due_date: string | null;
  course: {
    title: string;
    category: string;
  };
  progress?: {
    completed_modules: string[];
    total_modules: number;
    completed_at: string | null;
  };
}

const EmployeeCoursesPage = () => {
  const { user, fullName } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssignments();
  }, [user]);

  const fetchAssignments = async () => {
    if (!user) return;

    // Get employee record
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!emp) {
      setLoading(false);
      return;
    }

    // Get assignments with course info
    const { data: assigns } = await supabase
      .from("course_assignments")
      .select("id, course_id, status, due_date")
      .eq("employee_id", emp.id)
      .order("assigned_at", { ascending: false });

    if (!assigns?.length) {
      setAssignments([]);
      setLoading(false);
      return;
    }

    // Enrich with course data and progress
    const enriched: Assignment[] = await Promise.all(
      assigns.map(async (a) => {
        const [courseRes, progressRes, modulesRes] = await Promise.all([
          supabase.from("courses").select("title, category").eq("id", a.course_id).single(),
          supabase.from("course_progress").select("completed_modules, completed_at").eq("assignment_id", a.id).maybeSingle(),
          supabase.from("course_modules").select("id", { count: "exact", head: true }).eq("course_id", a.course_id),
        ]);

        return {
          ...a,
          course: courseRes.data || { title: "Unknown", category: "" },
          progress: {
            completed_modules: (progressRes.data?.completed_modules as string[]) || [],
            total_modules: modulesRes.count || 0,
            completed_at: progressRes.data?.completed_at || null,
          },
        };
      })
    );

    setAssignments(enriched);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const active = assignments.filter((a) => a.status !== "completed");
  const completed = assignments.filter((a) => a.status === "completed");

  const getProgressPercent = (a: Assignment) => {
    if (!a.progress?.total_modules) return 0;
    return Math.round((a.progress.completed_modules.length / a.progress.total_modules) * 100);
  };

  const getStatusLabel = (a: Assignment) => {
    if (a.status === "completed") return "Completed";
    if (a.progress && a.progress.completed_modules.length > 0) return "In Progress";
    return "Not Started";
  };

  const getStatusVariant = (a: Assignment): "default" | "outline" | "secondary" => {
    if (a.status === "completed") return "default";
    if (a.progress && a.progress.completed_modules.length > 0) return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Hello {fullName?.split(" ")[0] || "there"}, here are your assigned courses
        </h1>
        <p className="text-muted-foreground mt-1">Complete your training to earn certificates.</p>
      </div>

      {assignments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <BookOpen className="mb-4 h-16 w-16 text-muted-foreground/50" />
          <h2 className="mb-2 text-xl font-bold text-foreground">No courses assigned yet</h2>
          <p className="text-muted-foreground">Your HR admin will assign courses to you soon.</p>
        </div>
      ) : (
        <>
          {/* Active courses */}
          {active.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Active Courses</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {active.map((a) => {
                  const pct = getProgressPercent(a);
                  return (
                    <Card key={a.id} className="flex flex-col">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <Badge variant="outline" className="text-xs">{a.course.category}</Badge>
                          <Badge variant={getStatusVariant(a)}>{getStatusLabel(a)}</Badge>
                        </div>
                        <CardTitle className="mt-2 text-base">{a.course.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col justify-end gap-4">
                        <div>
                          <div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
                            <span>Progress</span>
                            <span>{pct}%</span>
                          </div>
                          <Progress value={pct} className="h-2" />
                        </div>
                        {a.due_date && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            Due {new Date(a.due_date).toLocaleDateString()}
                          </div>
                        )}
                        <Button asChild className="w-full">
                          <Link to={`/employee/learn/${a.course_id}`}>
                            <PlayCircle className="mr-2 h-4 w-4" />
                            {pct > 0 ? "Continue" : "Start"}
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completed courses */}
          {completed.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Completed Courses</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {completed.map((a) => (
                  <Card key={a.id} className="flex flex-col">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <Badge variant="outline" className="text-xs">{a.course.category}</Badge>
                        <Badge variant="default">Completed</Badge>
                      </div>
                      <CardTitle className="mt-2 text-base">{a.course.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col justify-end gap-3">
                      <Progress value={100} className="h-2" />
                      {a.progress?.completed_at && (
                        <p className="text-xs text-muted-foreground">
                          Completed on {new Date(a.progress.completed_at).toLocaleDateString()}
                        </p>
                      )}
                      <Button variant="outline" asChild className="w-full">
                        <Link to={`/employee/certificates`}>
                          <Award className="mr-2 h-4 w-4" /> View Certificate
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EmployeeCoursesPage;
