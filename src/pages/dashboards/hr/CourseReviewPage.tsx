import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Trash2, Plus, Check, Save, Rocket, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Course {
  id: string;
  title: string;
  description: string | null;
  category: string;
  language: string;
  duration_minutes: number | null;
  learning_objectives: string[];
  status: string;
}

interface Module {
  id: string;
  module_number: number;
  title: string;
  content: string;
  key_points: string[];
}

interface QuizQuestion {
  id: string;
  question_number: number;
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string | null;
}

const CourseReviewPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (id) fetchCourse();
  }, [id]);

  const fetchCourse = async () => {
    setLoading(true);
    const [courseRes, modulesRes, quizRes] = await Promise.all([
      supabase.from("courses").select("*").eq("id", id!).single(),
      supabase.from("course_modules").select("*").eq("course_id", id!).order("module_number"),
      supabase.from("quiz_questions").select("*").eq("course_id", id!).order("question_number"),
    ]);

    if (courseRes.data) setCourse(courseRes.data as Course);
    if (modulesRes.data) setModules(modulesRes.data as Module[]);
    if (quizRes.data) setQuestions(quizRes.data as QuizQuestion[]);
    setLoading(false);

    // Auto-expand first module
    if (modulesRes.data?.length) setExpandedModules(new Set([modulesRes.data[0].id]));
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      next.has(moduleId) ? next.delete(moduleId) : next.add(moduleId);
      return next;
    });
  };

  const updateCourseField = (field: keyof Course, value: any) => {
    if (course) setCourse({ ...course, [field]: value });
  };

  const updateModule = (moduleId: string, field: keyof Module, value: any) => {
    setModules((prev) => prev.map((m) => (m.id === moduleId ? { ...m, [field]: value } : m)));
  };

  const deleteModule = (moduleId: string) => {
    setModules((prev) => prev.filter((m) => m.id !== moduleId));
  };

  const updateQuestion = (qId: string, field: keyof QuizQuestion, value: any) => {
    setQuestions((prev) => prev.map((q) => (q.id === qId ? { ...q, [field]: value } : q)));
  };

  const deleteQuestion = (qId: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== qId));
  };

  const addQuestion = () => {
    const newQ: QuizQuestion = {
      id: `new-${Date.now()}`,
      question_number: questions.length + 1,
      question: "",
      options: ["A. ", "B. ", "C. ", "D. "],
      correct_answer: "A",
      explanation: "",
    };
    setQuestions([...questions, newQ]);
  };

  const save = async (publish = false) => {
    if (!course) return;
    setSaving(true);

    try {
      // Update course
      const { error: courseErr } = await supabase
        .from("courses")
        .update({
          title: course.title,
          description: course.description,
          learning_objectives: course.learning_objectives,
          status: publish ? "published" : "draft",
        })
        .eq("id", course.id);
      if (courseErr) throw courseErr;

      // Delete removed modules and questions, then upsert
      const existingModuleIds = modules.filter((m) => !m.id.startsWith("new-")).map((m) => m.id);
      if (existingModuleIds.length > 0) {
        await supabase.from("course_modules").delete().eq("course_id", course.id).not("id", "in", `(${existingModuleIds.join(",")})`);
      }

      for (const mod of modules) {
        if (mod.id.startsWith("new-")) {
          await supabase.from("course_modules").insert({
            course_id: course.id,
            module_number: mod.module_number,
            title: mod.title,
            content: mod.content,
            key_points: mod.key_points,
          });
        } else {
          await supabase.from("course_modules").update({
            title: mod.title,
            content: mod.content,
            key_points: mod.key_points,
            module_number: mod.module_number,
          }).eq("id", mod.id);
        }
      }

      // Quiz questions
      const existingQIds = questions.filter((q) => !q.id.startsWith("new-")).map((q) => q.id);
      if (existingQIds.length > 0) {
        await supabase.from("quiz_questions").delete().eq("course_id", course.id).not("id", "in", `(${existingQIds.join(",")})`);
      }

      for (const q of questions) {
        if (q.id.startsWith("new-")) {
          await supabase.from("quiz_questions").insert({
            course_id: course.id,
            question_number: q.question_number,
            question: q.question,
            options: q.options,
            correct_answer: q.correct_answer,
            explanation: q.explanation,
          });
        } else {
          await supabase.from("quiz_questions").update({
            question: q.question,
            options: q.options,
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            question_number: q.question_number,
          }).eq("id", q.id);
        }
      }

      toast({
        title: publish ? "Course published!" : "Draft saved",
        description: publish ? "Course is now available for assignment." : "Your changes have been saved.",
      });

      if (publish) navigate("/hr/courses");
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!course) {
    return <div className="py-24 text-center text-muted-foreground">Course not found.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-24">
      {/* Header */}
      <div className="space-y-4">
        <Input
          value={course.title}
          onChange={(e) => updateCourseField("title", e.target.value)}
          className="text-2xl font-bold border-none bg-transparent p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <Textarea
          value={course.description || ""}
          onChange={(e) => updateCourseField("description", e.target.value)}
          placeholder="Course description..."
          className="resize-none border-none bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-muted-foreground"
          rows={2}
        />
        <div className="flex flex-wrap gap-2">
          {course.duration_minutes && (
            <Badge variant="secondary">{course.duration_minutes} min</Badge>
          )}
          <Badge variant="secondary">{course.category}</Badge>
          <Badge variant="secondary">{course.language}</Badge>
          <Badge variant={course.status === "published" ? "default" : "outline"}>
            {course.status}
          </Badge>
        </div>
      </div>

      {/* Learning Objectives */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Learning Objectives</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {course.learning_objectives?.map((obj, i) => (
            <div key={i} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <Input
                value={obj}
                onChange={(e) => {
                  const updated = [...course.learning_objectives];
                  updated[i] = e.target.value;
                  updateCourseField("learning_objectives", updated);
                }}
                className="border-none bg-transparent p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Modules */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground">Modules ({modules.length})</h2>
        {modules.map((mod) => (
          <Collapsible
            key={mod.id}
            open={expandedModules.has(mod.id)}
            onOpenChange={() => toggleModule(mod.id)}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Module {mod.module_number}: {mod.title}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); deleteModule(mod.id); }}
                        className="h-8 w-8 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      {expandedModules.has(mod.id) ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Title</label>
                    <Input
                      value={mod.title}
                      onChange={(e) => updateModule(mod.id, "title", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Content</label>
                    <Textarea
                      value={mod.content}
                      onChange={(e) => updateModule(mod.id, "content", e.target.value)}
                      rows={8}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Key Points</label>
                    {mod.key_points?.map((kp, i) => (
                      <Input
                        key={i}
                        value={kp}
                        onChange={(e) => {
                          const updated = [...mod.key_points];
                          updated[i] = e.target.value;
                          updateModule(mod.id, "key_points", updated);
                        }}
                        className="mb-2"
                      />
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>

      {/* Quiz */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Quiz ({questions.length} questions)</h2>
          <Button variant="outline" size="sm" onClick={addQuestion}>
            <Plus className="mr-1 h-4 w-4" /> Add Question
          </Button>
        </div>
        {questions.map((q, qi) => (
          <Card key={q.id}>
            <CardContent className="space-y-3 p-6">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Question {qi + 1}</label>
                  <Textarea
                    value={q.question}
                    onChange={(e) => updateQuestion(q.id, "question", e.target.value)}
                    rows={2}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteQuestion(q.id)}
                  className="h-8 w-8 text-destructive shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {q.options.map((opt, oi) => {
                  const letter = String.fromCharCode(65 + oi);
                  const isCorrect = q.correct_answer === letter;
                  return (
                    <div
                      key={oi}
                      className={cn(
                        "flex items-center gap-2 rounded-md border p-2",
                        isCorrect ? "border-accent bg-accent/10" : "border-border"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => updateQuestion(q.id, "correct_answer", letter)}
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                          isCorrect ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {letter}
                      </button>
                      <Input
                        value={opt.replace(/^[A-D]\.\s*/, "")}
                        onChange={(e) => {
                          const updated = [...q.options];
                          updated[oi] = `${letter}. ${e.target.value}`;
                          updateQuestion(q.id, "options", updated);
                        }}
                        className="border-none bg-transparent p-0 h-auto focus-visible:ring-0 text-sm"
                      />
                    </div>
                  );
                })}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Explanation</label>
                <Input
                  value={q.explanation || ""}
                  onChange={(e) => updateQuestion(q.id, "explanation", e.target.value)}
                  placeholder="Why is this the correct answer?"
                  className="text-sm"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card p-4">
        <div className="mx-auto flex max-w-4xl items-center justify-end gap-3">
          <Button variant="outline" onClick={() => save(false)} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save as Draft"}
          </Button>
          <Button onClick={() => save(true)} disabled={saving} className="bg-primary text-primary-foreground">
            <Rocket className="mr-2 h-4 w-4" />
            {saving ? "Publishing..." : "Publish Course"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CourseReviewPage;
