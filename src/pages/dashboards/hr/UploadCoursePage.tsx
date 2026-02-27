import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileText, X, BookOpen, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
];
const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".txt"];
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

const CATEGORIES = [
  "Compliance",
  "AML",
  "Customer Service",
  "Risk Management",
  "IT Security",
  "HR Policy",
  "Other",
];

const LANGUAGES = ["English", "Georgian", "Russian"];

const LOADING_MESSAGES_FILE = [
  "Analyzing your content...",
  "Identifying key learning objectives...",
  "Structuring course modules...",
  "Generating quiz questions...",
  "Almost ready...",
];

const LOADING_MESSAGES_YOUTUBE = [
  "Extracting video transcript...",
  "Analyzing transcript content...",
  "Identifying key learning objectives...",
  "Structuring course modules...",
  "Generating quiz questions...",
  "Almost ready...",
];

const UploadCoursePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [category, setCategory] = useState("Compliance");
  const [language, setLanguage] = useState("English");
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const validateFile = (f: File): boolean => {
    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      toast({ title: "Invalid file type", description: "Please upload PDF, DOCX, PPTX, or TXT files.", variant: "destructive" });
      return false;
    }
    if (f.size > MAX_SIZE) {
      toast({ title: "File too large", description: "Maximum file size is 20MB.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && validateFile(droppedFile)) setFile(droppedFile);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && validateFile(selected)) setFile(selected);
  };

  const handleGenerate = async () => {
    if (!file && !youtubeUrl.trim()) {
      toast({ title: "No content provided", description: "Upload a file or enter a YouTube URL.", variant: "destructive" });
      return;
    }

    const isYoutube = !file && !!youtubeUrl.trim();
    const loadingMessages = isYoutube ? LOADING_MESSAGES_YOUTUBE : LOADING_MESSAGES_FILE;

    setIsGenerating(true);
    setProgress(0);
    setLoadingMsgIndex(0);

    // Cycle loading messages
    const msgInterval = setInterval(() => {
      setLoadingMsgIndex((prev) => Math.min(prev + 1, loadingMessages.length - 1));
    }, 5000);

    // Animate progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 2, 90));
    }, 600);

    try {
      let filePath: string | null = null;

      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${user!.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("course-materials")
          .upload(path, file);
        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
        filePath = path;
      }

      const { data, error } = await supabase.functions.invoke("generate-course", {
        body: {
          filePath,
          youtubeUrl: youtubeUrl.trim() || null,
          category,
          language,
        },
      });

      if (error) {
        // Extract the actual error message from the edge function response
        const context = (error as any)?.context;
        let errorMsg = "Something went wrong.";
        if (context && typeof context === "object") {
          try {
            // context may be a Response object
            const body = context.body ? await new Response(context.body).json() : null;
            if (body?.error) errorMsg = body.error;
          } catch {
            // ignore parse errors
          }
        }
        throw new Error(errorMsg);
      }
      if (data?.error) throw new Error(data.error);

      setProgress(100);
      toast({ title: "Course generated!", description: "Review your new course." });

      setTimeout(() => {
        navigate(`/hr/courses/${data.courseId}/review`);
      }, 500);
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
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-8 px-6 text-center">
          <BookOpen className="h-16 w-16 text-primary animate-pulse" />
          <h1 className="text-2xl font-bold text-foreground">Quali.ge</h1>
          <div className="w-full max-w-md">
            <Progress value={progress} className="h-3" />
          </div>
          <p className="text-lg text-muted-foreground animate-pulse">
            {(youtubeUrl.trim() ? LOADING_MESSAGES_YOUTUBE : LOADING_MESSAGES_FILE)[loadingMsgIndex]}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Create Course</h1>
        <p className="text-muted-foreground">Upload training material and let AI build your course.</p>
      </div>

      {/* Upload Zone */}
      <Card>
        <CardContent className="p-6">
          {file ? (
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-4">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium text-foreground">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors",
                isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              )}
            >
              <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="mb-2 text-lg font-medium text-foreground">Drop your training material here</p>
              <p className="mb-4 text-sm text-muted-foreground">PDF, DOCX, PPTX, or TXT — max 20MB</p>
              <Button variant="outline" type="button">Browse files</Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS.join(",")}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* YouTube URL */}
      <Card>
        <CardContent className="p-6">
          <label className="mb-2 block text-sm font-medium text-foreground">Or paste a YouTube URL</label>
          <Input
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            disabled={!!file}
          />
          {youtubeUrl.trim() && !file && (
            <p className="mt-2 text-sm text-muted-foreground">
              ℹ️ We will extract the video transcript to generate your course. Video must have captions enabled.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Settings */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">Course Language</label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">Course Category</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={!file && !youtubeUrl.trim()}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 text-base font-semibold"
      >
        Generate Course with AI
      </Button>
    </div>
  );
};

export default UploadCoursePage;
