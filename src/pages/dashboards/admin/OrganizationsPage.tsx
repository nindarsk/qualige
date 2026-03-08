import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Building2, Users, BookOpen, Award, Zap, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/use-page-title";

interface OrgRow {
  id: string;
  name: string;
  industry: string | null;
  plan: string;
  plan_status: string;
  plan_ends_at: string | null;
  created_at: string;
  employee_count: number;
  course_count: number;
  cert_count: number;
}

interface PlatformStats {
  totalOrgs: number;
  totalEmployees: number;
  totalCourses: number;
  totalCerts: number;
}

const PLANS = ["pilot", "starter", "growth", "scale"];

const OrganizationsPage = () => {
  usePageTitle("Organizations | Super Admin");
  const { toast } = useToast();
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [stats, setStats] = useState<PlatformStats>({ totalOrgs: 0, totalEmployees: 0, totalCourses: 0, totalCerts: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<OrgRow | null>(null);
  const [detailLogs, setDetailLogs] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updatingOrg, setUpdatingOrg] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: organizations } = await supabase
        .from("organizations")
        .select("id, name, industry, plan, plan_status, plan_ends_at, created_at")
        .order("created_at", { ascending: false });

      if (!organizations) { setLoading(false); return; }

      // Get counts per org
      const enriched: OrgRow[] = await Promise.all(
        organizations.map(async (org) => {
          const [empRes, courseRes, certRes] = await Promise.all([
            supabase.from("employees").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
            supabase.from("courses").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
            supabase.from("certificates").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
          ]);
          return {
            ...org,
            industry: (org as any).industry || null,
            employee_count: empRes.count || 0,
            course_count: courseRes.count || 0,
            cert_count: certRes.count || 0,
          };
        })
      );

      setOrgs(enriched);
      setStats({
        totalOrgs: enriched.length,
        totalEmployees: enriched.reduce((s, o) => s + o.employee_count, 0),
        totalCourses: enriched.reduce((s, o) => s + o.course_count, 0),
        totalCerts: enriched.reduce((s, o) => s + o.cert_count, 0),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const setPlan = async (orgId: string, plan: string) => {
    setUpdatingOrg(orgId);
    const { error } = await supabase.from("organizations").update({ plan } as any).eq("id", orgId);
    if (error) {
      toast({ title: "Failed to update plan", variant: "destructive" });
    } else {
      setOrgs((prev) => prev.map((o) => o.id === orgId ? { ...o, plan } : o));
      toast({ title: `Plan updated to ${plan}` });
    }
    setUpdatingOrg(null);
  };

  const setPilotEndDate = async (orgId: string, date: Date) => {
    const { error } = await supabase
      .from("organizations")
      .update({ plan_ends_at: date.toISOString() } as any)
      .eq("id", orgId);
    if (error) {
      toast({ title: "Failed to update end date", variant: "destructive" });
    } else {
      setOrgs((prev) => prev.map((o) => o.id === orgId ? { ...o, plan_ends_at: date.toISOString() } : o));
      toast({ title: "Pilot end date updated" });
    }
  };

  const openDetail = async (org: OrgRow) => {
    setSelectedOrg(org);
    setDetailLoading(true);
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setDetailLogs((data as any[]) || []);
    setDetailLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statCards = [
    { title: "Total Organizations", value: stats.totalOrgs, icon: Building2 },
    { title: "Total Employees", value: stats.totalEmployees, icon: Users },
    { title: "Total Courses", value: stats.totalCourses, icon: BookOpen },
    { title: "Total Certificates", value: stats.totalCerts, icon: Award },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Platform Overview</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.title}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-primary">
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

      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {orgs.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No organizations registered yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Employees</TableHead>
                  <TableHead className="text-center">Courses</TableHead>
                  <TableHead className="text-center">Certs</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Pilot Ends</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgs.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">
                      <button className="text-primary hover:underline" onClick={() => openDetail(org)}>
                        {org.name}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{org.industry || "—"}</TableCell>
                    <TableCell>
                      <Select value={org.plan} onValueChange={(v) => setPlan(org.id, v)} disabled={updatingOrg === org.id}>
                        <SelectTrigger className="h-8 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PLANS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={org.plan_status === "active" ? "default" : "destructive"} className="capitalize">
                        {org.plan_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{org.employee_count}</TableCell>
                    <TableCell className="text-center">{org.course_count}</TableCell>
                    <TableCell className="text-center">{org.cert_count}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(org.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 text-xs">
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            {org.plan_ends_at ? format(new Date(org.plan_ends_at), "dd/MM/yy") : "Set"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={org.plan_ends_at ? new Date(org.plan_ends_at) : undefined}
                            onSelect={(d) => d && setPilotEndDate(org.id, d)}
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(org)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!selectedOrg} onOpenChange={(o) => !o && setSelectedOrg(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedOrg?.name} — Details</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-4 py-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{selectedOrg?.employee_count}</p>
              <p className="text-sm text-muted-foreground">Employees</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{selectedOrg?.course_count}</p>
              <p className="text-sm text-muted-foreground">Courses</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{selectedOrg?.cert_count}</p>
              <p className="text-sm text-muted-foreground">Certificates</p>
            </div>
          </div>
          <div>
            <h3 className="mb-2 font-semibold text-foreground">Recent Activity</h3>
            {detailLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : detailLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <div className="max-h-60 overflow-auto space-y-2">
                {detailLogs.map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between rounded border border-border p-2 text-sm">
                    <div>
                      <span className="font-medium">{log.user_name}</span>
                      <span className="text-muted-foreground"> — {log.action}</span>
                      <p className="text-xs text-muted-foreground">{log.details}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleDateString("en-GB")} {new Date(log.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrganizationsPage;
