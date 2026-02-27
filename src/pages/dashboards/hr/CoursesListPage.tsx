import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Eye, Pencil, Trash2, BookOpen, Loader2, UserPlus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import AssignCourseModal from "@/components/AssignCourseModal";

interface CourseRow {
  id: string;
  title: string;
  category: string;
  status: string;
  created_at: string;
  module_count?: number;
  question_count?: number;
}

const CoursesListPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignCourse, setAssignCourse] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("courses")
      .select("id, title, category, status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Failed to load courses", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Fetch module & question counts
    const coursesWithCounts: CourseRow[] = await Promise.all(
      (data || []).map(async (c) => {
        const [modRes, quizRes] = await Promise.all([
          supabase.from("course_modules").select("id", { count: "exact", head: true }).eq("course_id", c.id),
          supabase.from("quiz_questions").select("id", { count: "exact", head: true }).eq("course_id", c.id),
        ]);
        return {
          ...c,
          module_count: modRes.count ?? 0,
          question_count: quizRes.count ?? 0,
        };
      })
    );

    setCourses(coursesWithCounts);
    setLoading(false);
  };

  const deleteCourse = async (courseId: string) => {
    const { error } = await supabase.from("courses").delete().eq("id", courseId);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      setCourses((prev) => prev.filter((c) => c.id !== courseId));
      toast({ title: "Course deleted" });
    }
  };

  const filtered = statusFilter === "all" ? courses : courses.filter((c) => c.status === statusFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <BookOpen className="mb-4 h-16 w-16 text-muted-foreground/50" />
        <h2 className="mb-2 text-xl font-bold text-foreground">No courses yet</h2>
        <p className="mb-6 text-muted-foreground">Upload training material to create your first AI-powered course.</p>
        <Button asChild>
          <Link to="/hr/upload">
            <Plus className="mr-2 h-4 w-4" /> Create Your First Course
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Courses</h1>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
          <Button asChild>
            <Link to="/hr/upload">
              <Plus className="mr-2 h-4 w-4" /> New Course
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-center">Modules</TableHead>
                <TableHead className="text-center">Questions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((course) => (
                <TableRow key={course.id}>
                  <TableCell className="font-medium">{course.title}</TableCell>
                  <TableCell>{course.category}</TableCell>
                  <TableCell className="text-center">{course.module_count}</TableCell>
                  <TableCell className="text-center">{course.question_count}</TableCell>
                  <TableCell>
                    <Badge variant={course.status === "published" ? "default" : "outline"}>
                      {course.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(course.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {course.status === "published" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setAssignCourse({ id: course.id, title: course.title })}
                          title="Assign to employees"
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => navigate(`/hr/courses/${course.id}/review`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => navigate(`/hr/courses/${course.id}/review`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete course?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{course.title}" and all its modules and quiz questions.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteCourse(course.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {assignCourse && (
        <AssignCourseModal
          open={!!assignCourse}
          onOpenChange={(open) => !open && setAssignCourse(null)}
          courseId={assignCourse.id}
          courseTitle={assignCourse.title}
        />
      )}
    </div>
  );
};

export default CoursesListPage;
