import { CheckCircle2, Circle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface Module {
  id: string;
  module_number: number;
  title: string;
}

interface ModuleSidebarProps {
  modules: Module[];
  currentIndex: number;
  completedModules: Set<string>;
  courseTitle: string;
  onSelectModule: (index: number) => void;
  isMobile: boolean;
  t: (key: string) => string;
}

const ModuleSidebar = ({
  modules,
  currentIndex,
  completedModules,
  courseTitle,
  onSelectModule,
  isMobile,
  t,
}: ModuleSidebarProps) => {
  if (isMobile) {
    return (
      <div className="border-b border-border bg-card px-4 py-3">
        <Select
          value={String(currentIndex)}
          onValueChange={(v) => onSelectModule(Number(v))}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {modules[currentIndex]
                ? `Module ${currentIndex + 1}: ${modules[currentIndex].title}`
                : "Select module"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {modules.map((mod, idx) => (
              <SelectItem key={mod.id} value={String(idx)}>
                <div className="flex items-center gap-2">
                  {completedModules.has(mod.id) ? (
                    <CheckCircle2 className="h-3 w-3 text-accent" />
                  ) : (
                    <Circle className="h-3 w-3" />
                  )}
                  Module {idx + 1}: {mod.title}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <aside className="flex w-72 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <BookOpen className="h-5 w-5 text-primary" />
        <h2 className="text-sm font-bold text-foreground truncate">{courseTitle}</h2>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {modules.map((mod, idx) => {
          const isComplete = completedModules.has(mod.id);
          const isCurrent = idx === currentIndex;
          return (
            <button
              key={mod.id}
              onClick={() => onSelectModule(idx)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                isCurrent ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {isComplete ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--accent))" }} />
              ) : (
                <Circle className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">{mod.title}</span>
            </button>
          );
        })}
      </nav>
      <div className="border-t border-border p-4">
        <Button variant="outline" className="w-full" asChild>
          <Link to="/employee">{t("learn.backToDashboard")}</Link>
        </Button>
      </div>
    </aside>
  );
};

export default ModuleSidebar;
