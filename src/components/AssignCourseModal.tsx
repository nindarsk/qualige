import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { logAuditEvent } from "@/lib/audit-log";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { CalendarIcon, Loader2, Search } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
}

interface AssignCourseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  courseTitle: string;
}

const AssignCourseModal = ({ open, onOpenChange, courseId, courseTitle }: AssignCourseModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (open) {
      fetchEmployees();
      setSelected(new Set());
      setSearch("");
      setDueDate(undefined);
    }
  }, [open]);

  const fetchEmployees = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("employees")
      .select("id, full_name, email, department")
      .eq("status", "active")
      .order("full_name");
    setEmployees(data || []);
    setLoading(false);
  };

  const filtered = employees.filter(
    (e) =>
      e.full_name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((e) => e.id)));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleAssign = async () => {
    if (selected.size === 0) return;
    setAssigning(true);

    try {
      const assignments = Array.from(selected).map((employeeId) => ({
        course_id: courseId,
        employee_id: employeeId,
        organization_id: "", // will be set by checking
        assigned_by: user!.id,
        due_date: dueDate?.toISOString() || null,
      }));

      // Get organization_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", user!.id)
        .single();

      if (!profile?.organization_id) throw new Error("No organization");

      const rows = assignments.map((a) => ({ ...a, organization_id: profile.organization_id! }));

      const { error } = await supabase.from("course_assignments").insert(rows);
      if (error) throw error;

      toast({
        title: "Course assigned!",
        description: `Course assigned to ${selected.size} employee${selected.size > 1 ? "s" : ""} successfully.`,
      });

      // Send assignment notification emails & audit log
      for (const empId of selected) {
        const emp = employees.find((e) => e.id === empId);
        logAuditEvent({ action: "COURSE_ASSIGNED", details: `Course: ${courseTitle} assigned to ${emp?.full_name || "employee"}` });

        // Send assignment email
        if (emp) {
          console.log("Invoking send-email for assignment notification to:", emp.email);
          const dueDateText = dueDate ? `<p>Completion deadline: <strong>${format(dueDate, "PPP")}</strong></p>` : "";
          const { data: emailData, error: emailError } = await supabase.functions.invoke("send-email", {
            body: {
              to: emp.email,
              subject: `New Training Assigned: ${courseTitle}`,
              html_body: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: #1B3A6B; padding: 24px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">Quali.ge</h1>
                    <div style="height: 3px; background: #C9A84C; margin-top: 12px;"></div>
                  </div>
                  <div style="padding: 32px; background: white;">
                    <h2 style="color: #1B3A6B;">Hello, ${emp.full_name}!</h2>
                    <p>You have been assigned a new training course:</p>
                    <p style="font-size: 18px; font-weight: bold; color: #1B3A6B;">${courseTitle}</p>
                    ${dueDateText}
                    <p>Please log in to Quali.ge to start your training.</p>
                    <a href="https://qualige.lovable.app/employee/courses" style="display: inline-block; background: #1B3A6B; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; margin-top: 16px;">Start Course</a>
                  </div>
                  <div style="background: #1B3A6B; padding: 16px; text-align: center;">
                    <p style="color: rgba(255,255,255,0.6); font-size: 12px; margin: 0;">Quali.ge — AI-powered Learning Management System</p>
                  </div>
                </div>`,
            },
          });
          console.log("send-email response:", emailData, emailError);
          if (emailError) console.error("Failed to send assignment email:", emailError);
        }
      }

      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Assignment failed", description: err.message, variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Course</DialogTitle>
          <p className="text-sm text-muted-foreground">Assign "{courseTitle}" to employees</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Employee list */}
          <div className="max-h-60 overflow-y-auto rounded-lg border border-border">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                No active employees found.
              </p>
            ) : (
              <>
                <div
                  className="flex items-center gap-3 border-b border-border px-4 py-3 hover:bg-muted/50 cursor-pointer"
                  onClick={toggleAll}
                >
                  <Checkbox checked={selected.size === filtered.length && filtered.length > 0} />
                  <span className="text-sm font-medium">Select All ({filtered.length})</span>
                </div>
                {filtered.map((emp) => (
                  <div
                    key={emp.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggle(emp.id)}
                  >
                    <Checkbox checked={selected.has(emp.id)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{emp.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                    </div>
                    {emp.department && (
                      <span className="text-xs text-muted-foreground">{emp.department}</span>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Due date */}
          <div>
            <Label>Completion Deadline (optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "mt-1 w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  disabled={(d) => d < new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleAssign} disabled={selected.size === 0 || assigning}>
            {assigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assign Course ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignCourseModal;
