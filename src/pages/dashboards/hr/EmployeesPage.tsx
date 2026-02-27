import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Loader2, Users, MoreHorizontal, Mail, Trash2, UserX } from "lucide-react";

interface Employee {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  status: string;
  invited_at: string;
  joined_at: string | null;
  courses_assigned?: number;
  courses_completed?: number;
}

const EmployeesPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteForm, setInviteForm] = useState({ fullName: "", email: "", department: "" });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("invited_at", { ascending: false });

    if (error) {
      toast({ title: "Failed to load employees", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Fetch assignment counts
    const enriched: Employee[] = await Promise.all(
      (data || []).map(async (emp) => {
        const [assignedRes, completedRes] = await Promise.all([
          supabase.from("course_assignments").select("id", { count: "exact", head: true }).eq("employee_id", emp.id),
          supabase.from("course_assignments").select("id", { count: "exact", head: true }).eq("employee_id", emp.id).eq("status", "completed"),
        ]);
        return {
          ...emp,
          courses_assigned: assignedRes.count ?? 0,
          courses_completed: completedRes.count ?? 0,
        };
      })
    );

    setEmployees(enriched);
    setLoading(false);
  };

  const handleInvite = async () => {
    if (!inviteForm.fullName.trim() || !inviteForm.email.trim()) {
      toast({ title: "Please fill in name and email", variant: "destructive" });
      return;
    }

    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-employee", {
        body: {
          fullName: inviteForm.fullName.trim(),
          email: inviteForm.email.trim(),
          department: inviteForm.department.trim() || null,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({ title: "Invitation sent!", description: `${inviteForm.fullName} has been invited.` });
      setInviteForm({ fullName: "", email: "", department: "" });
      setInviteOpen(false);
      fetchEmployees();
    } catch (err: any) {
      toast({ title: "Invitation failed", description: err.message, variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  const resendInvite = async (emp: Employee) => {
    try {
      const { error } = await supabase.functions.invoke("invite-employee", {
        body: {
          fullName: emp.full_name,
          email: emp.email,
          department: emp.department,
          resend: true,
        },
      });
      if (error) throw error;
      toast({ title: "Invitation resent", description: `Resent to ${emp.email}` });
    } catch (err: any) {
      toast({ title: "Failed to resend", description: err.message, variant: "destructive" });
    }
  };

  const deleteEmployee = async (empId: string) => {
    const { error } = await supabase.from("employees").delete().eq("id", empId);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      setEmployees((prev) => prev.filter((e) => e.id !== empId));
      toast({ title: "Employee removed" });
    }
  };

  const deactivateEmployee = async (emp: Employee) => {
    const newStatus = emp.status === "inactive" ? "active" : "inactive";
    const { error } = await supabase
      .from("employees")
      .update({ status: newStatus })
      .eq("id", emp.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      setEmployees((prev) =>
        prev.map((e) => (e.id === emp.id ? { ...e, status: newStatus } : e))
      );
      toast({ title: `Employee ${newStatus === "inactive" ? "deactivated" : "activated"}` });
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>;
      case "pending":
        return <Badge variant="outline" className="border-amber-300 text-amber-600">Pending</Badge>;
      case "inactive":
        return <Badge variant="secondary" className="text-muted-foreground">Inactive</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Employees</h1>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Invite Employee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Employee</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="inv-name">Full Name</Label>
                <Input
                  id="inv-name"
                  placeholder="John Doe"
                  value={inviteForm.fullName}
                  onChange={(e) => setInviteForm((f) => ({ ...f, fullName: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="inv-email">Work Email</Label>
                <Input
                  id="inv-email"
                  type="email"
                  placeholder="john@company.com"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="inv-dept">Department</Label>
                <Input
                  id="inv-dept"
                  placeholder="e.g. Operations, Compliance"
                  value={inviteForm.department}
                  onChange={(e) => setInviteForm((f) => ({ ...f, department: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleInvite} disabled={inviting}>
                {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Send Invitation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Users className="mb-4 h-16 w-16 text-muted-foreground/50" />
          <h2 className="mb-2 text-xl font-bold text-foreground">No employees yet</h2>
          <p className="mb-6 text-muted-foreground">Invite your team to start assigning courses.</p>
          <Button onClick={() => setInviteOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Invite Your First Employee
          </Button>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-center">Assigned</TableHead>
                  <TableHead className="text-center">Completed</TableHead>
                  <TableHead>Date Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{emp.email}</TableCell>
                    <TableCell>{emp.department || "—"}</TableCell>
                    <TableCell className="text-center">{emp.courses_assigned}</TableCell>
                    <TableCell className="text-center">{emp.courses_completed}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {emp.joined_at
                        ? new Date(emp.joined_at).toLocaleDateString()
                        : new Date(emp.invited_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{statusBadge(emp.status)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {emp.status === "pending" && (
                            <DropdownMenuItem onClick={() => resendInvite(emp)}>
                              <Mail className="mr-2 h-4 w-4" /> Resend Invitation
                            </DropdownMenuItem>
                          )}
                          {emp.status !== "pending" && (
                            <DropdownMenuItem onClick={() => deactivateEmployee(emp)}>
                              <UserX className="mr-2 h-4 w-4" />
                              {emp.status === "inactive" ? "Activate" : "Deactivate"}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteEmployee(emp.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EmployeesPage;
