import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Users, Award, BarChart3, CheckCircle, FileDown, FileSpreadsheet, Search, Download, ChevronLeft, ChevronRight, CalendarIcon, ClipboardList } from "lucide-react";
import { downloadCertificate } from "@/lib/download-certificate";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import { usePageTitle } from "@/hooks/use-page-title";

interface ReportRow {
  employeeName: string;
  employeeId: string;
  department: string;
  courseTitle: string;
  courseId: string;
  assignedDate: string;
  completionDate: string | null;
  quizScore: number | null;
  status: string;
  certificateId: string | null;
  userId: string | null;
}

interface EmployeeCourseHistory {
  courseTitle: string;
  assignedDate: string;
  completionDate: string | null;
  quizScore: number | null;
  status: string;
  certificateId: string | null;
  userId: string | null;
  employeeId: string;
}

interface AuditLogEntry {
  id: string;
  user_name: string;
  user_role: string;
  action: string;
  details: string;
  created_at: string;
}

const ROWS_PER_PAGE = 25;

const AUDIT_ACTIONS = [
  "USER_LOGIN",
  "COURSE_CREATED",
  "COURSE_PUBLISHED",
  "COURSE_ASSIGNED",
  "COURSE_STARTED",
  "COURSE_COMPLETED",
  "QUIZ_PASSED",
  "QUIZ_FAILED",
  "CERTIFICATE_DOWNLOADED",
  "EMPLOYEE_INVITED",
  "EMPLOYEE_ACTIVATED",
];

const ReportsPage = () => {
  const { organizationId, organizationName } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("all");
  const [filterCourse, setFilterCourse] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<{ name: string; id: string } | null>(null);
  const [empHistory, setEmpHistory] = useState<EmployeeCourseHistory[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [downloadingCertId, setDownloadingCertId] = useState<string | null>(null);
  const [stats, setStats] = useState({ trainedThisMonth: 0, certificatesIssued: 0, avgQuizScore: 0, complianceRate: 0 });

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState("all");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditDateFrom, setAuditDateFrom] = useState<Date | undefined>();
  const [auditDateTo, setAuditDateTo] = useState<Date | undefined>();
  const [auditPage, setAuditPage] = useState(1);
  const [auditExporting, setAuditExporting] = useState<"pdf" | "csv" | null>(null);

  useEffect(() => {
    if (organizationId) fetchReportData();
  }, [organizationId]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const { data: assignments } = await supabase
        .from("course_assignments")
        .select("id, course_id, employee_id, assigned_at, status, due_date")
        .order("assigned_at", { ascending: false });

      if (!assignments?.length) { setLoading(false); return; }

      const empIds = [...new Set(assignments.map((a) => a.employee_id))];
      const courseIds = [...new Set(assignments.map((a) => a.course_id))];

      const [empRes, courseRes, quizRes, certRes] = await Promise.all([
        supabase.from("employees").select("id, full_name, department, user_id").in("id", empIds),
        supabase.from("courses").select("id, title").in("id", courseIds),
        supabase.from("quiz_attempts").select("employee_id, course_id, score, passed").in("employee_id", empIds),
        supabase.from("certificates").select("employee_id, course_id, certificate_id").in("employee_id", empIds),
      ]);

      const empMap = new Map((empRes.data || []).map((e) => [e.id, e]));
      const courseMap = new Map((courseRes.data || []).map((c) => [c.id, c]));

      const quizMap = new Map<string, number>();
      (quizRes.data || []).forEach((q) => {
        const key = `${q.employee_id}_${q.course_id}`;
        const existing = quizMap.get(key);
        if (!existing || Number(q.score) > existing) quizMap.set(key, Number(q.score));
      });

      const certMap = new Map<string, string>();
      (certRes.data || []).forEach((c) => {
        certMap.set(`${c.employee_id}_${c.course_id}`, c.certificate_id);
      });

      const reportRows: ReportRow[] = assignments.map((a) => {
        const emp = empMap.get(a.employee_id);
        const course = courseMap.get(a.course_id);
        const quizKey = `${a.employee_id}_${a.course_id}`;
        return {
          employeeName: emp?.full_name || "Unknown",
          employeeId: a.employee_id,
          department: emp?.department || "—",
          courseTitle: course?.title || "Unknown",
          courseId: a.course_id,
          assignedDate: new Date(a.assigned_at).toLocaleDateString(),
          completionDate: a.status === "completed" ? new Date(a.assigned_at).toLocaleDateString() : null,
          quizScore: quizMap.get(quizKey) ?? null,
          status: a.status,
          certificateId: certMap.get(quizKey) || null,
          userId: emp?.user_id || null,
        };
      });

      setRows(reportRows);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const completedThisMonth = reportRows.filter(
        (r) => r.status === "completed" && r.completionDate && new Date(r.completionDate) >= monthStart
      ).length;
      const allScores = reportRows.filter((r) => r.quizScore !== null).map((r) => r.quizScore!);
      const avgScore = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
      const totalCerts = reportRows.filter((r) => r.certificateId).length;
      const empAssignments = new Map<string, { total: number; completed: number }>();
      reportRows.forEach((r) => {
        const entry = empAssignments.get(r.employeeId) || { total: 0, completed: 0 };
        entry.total++;
        if (r.status === "completed") entry.completed++;
        empAssignments.set(r.employeeId, entry);
      });
      const fullyCompliant = [...empAssignments.values()].filter((e) => e.total > 0 && e.completed === e.total).length;
      const complianceRate = empAssignments.size > 0 ? Math.round((fullyCompliant / empAssignments.size) * 100) : 0;

      setStats({ trainedThisMonth: completedThisMonth, certificatesIssued: totalCerts, avgQuizScore: Math.round(avgScore), complianceRate });
    } catch (err) {
      console.error("Reports error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch audit logs
  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (auditFilter !== "all") {
        query = query.eq("action", auditFilter);
      }
      if (auditDateFrom) {
        query = query.gte("created_at", auditDateFrom.toISOString());
      }
      if (auditDateTo) {
        const endOfDay = new Date(auditDateTo);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }

      const { data } = await query;
      setAuditLogs((data as AuditLogEntry[]) || []);
    } catch (err) {
      console.error("Audit log error:", err);
    } finally {
      setAuditLoading(false);
    }
  };

  const departments = useMemo(() => [...new Set(rows.map((r) => r.department).filter((d) => d !== "—"))], [rows]);
  const courses = useMemo(() => [...new Set(rows.map((r) => r.courseTitle))], [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (search && !r.employeeName.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterDept !== "all" && r.department !== filterDept) return false;
      if (filterCourse !== "all" && r.courseTitle !== filterCourse) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      return true;
    });
  }, [rows, search, filterDept, filterCourse, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE));
  const paginatedRows = filteredRows.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  useEffect(() => { setPage(1); }, [search, filterDept, filterCourse, filterStatus]);

  // Filtered audit logs
  const filteredAuditLogs = useMemo(() => {
    if (!auditSearch) return auditLogs;
    const q = auditSearch.toLowerCase();
    return auditLogs.filter(
      (l) => l.user_name.toLowerCase().includes(q) || l.details.toLowerCase().includes(q) || l.action.toLowerCase().includes(q)
    );
  }, [auditLogs, auditSearch]);

  const auditTotalPages = Math.max(1, Math.ceil(filteredAuditLogs.length / ROWS_PER_PAGE));
  const paginatedAuditLogs = filteredAuditLogs.slice((auditPage - 1) * ROWS_PER_PAGE, auditPage * ROWS_PER_PAGE);

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Completed</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">In Progress</Badge>;
      default:
        return <Badge variant="outline" className="border-amber-300 text-amber-600">Assigned</Badge>;
    }
  };

  const formatAuditTimestamp = (ts: string) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  };

  // PDF Export for compliance
  const exportPdf = async () => {
    setExporting("pdf");
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = 297;
      doc.setFillColor(27, 58, 107);
      doc.rect(0, 0, pageW, 25, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Training Compliance Report", 14, 16);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(organizationName || "Organization", pageW - 14, 16, { align: "right" });
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(9);
      doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 14, 33);
      doc.setFontSize(10);
      doc.setTextColor(27, 58, 107);
      doc.setFont("helvetica", "bold");
      doc.text("Summary", 14, 42);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text(`Employees trained this month: ${stats.trainedThisMonth}`, 14, 48);
      doc.text(`Certificates issued: ${stats.certificatesIssued}`, 100, 48);
      doc.text(`Average quiz score: ${stats.avgQuizScore}%`, 190, 48);
      doc.text(`Compliance rate: ${stats.complianceRate}%`, 14, 54);

      let y = 64;
      const cols = [14, 60, 95, 130, 160, 190, 220, 250];
      const headers = ["Employee", "Department", "Course", "Assigned", "Completed", "Score", "Status", "Cert ID"];
      doc.setFillColor(240, 240, 245);
      doc.rect(10, y - 5, pageW - 20, 8, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(27, 58, 107);
      headers.forEach((h, i) => doc.text(h, cols[i], y));
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 40, 40);

      filteredRows.forEach((row) => {
        if (y > 190) {
          doc.addPage();
          y = 20;
          doc.setFillColor(240, 240, 245);
          doc.rect(10, y - 5, pageW - 20, 8, "F");
          doc.setFont("helvetica", "bold");
          doc.setTextColor(27, 58, 107);
          headers.forEach((h, i) => doc.text(h, cols[i], y));
          y += 6;
          doc.setFont("helvetica", "normal");
          doc.setTextColor(40, 40, 40);
        }
        doc.text(row.employeeName.substring(0, 22), cols[0], y);
        doc.text((row.department || "—").substring(0, 16), cols[1], y);
        doc.text(row.courseTitle.substring(0, 18), cols[2], y);
        doc.text(row.assignedDate, cols[3], y);
        doc.text(row.completionDate || "—", cols[4], y);
        doc.text(row.quizScore !== null ? `${Math.round(row.quizScore)}%` : "—", cols[5], y);
        doc.text(row.status, cols[6], y);
        doc.text(row.certificateId || "—", cols[7], y);
        y += 6;
      });

      const lastPage = doc.getNumberOfPages();
      for (let i = 1; i <= lastPage; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${lastPage}`, pageW - 14, 205, { align: "right" });
        doc.text("Powered by Quali.ge", 14, 205);
      }
      doc.save(`Quali-Compliance-Report-${new Date().toISOString().split("T")[0]}.pdf`);
    } finally {
      setExporting(null);
    }
  };

  const exportExcel = async () => {
    setExporting("xlsx");
    try {
      const escCsv = (val: string) => {
        if (val.includes(",") || val.includes('"') || val.includes("\n")) return `"${val.replace(/"/g, '""')}"`;
        return val;
      };
      const headers = ["Employee", "Department", "Course", "Assigned Date", "Completion Date", "Quiz Score", "Status", "Certificate ID"];
      const csvRows = filteredRows.map((r) => [
        r.employeeName, r.department, r.courseTitle, r.assignedDate, r.completionDate || "", r.quizScore !== null ? `${Math.round(r.quizScore)}%` : "", r.status, r.certificateId || "",
      ]);
      const csvContent = [headers, ...csvRows].map(row => row.map(escCsv).join(",")).join("\n");
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Quali-Compliance-Report-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  };

  // Audit log exports
  const exportAuditPdf = async () => {
    setAuditExporting("pdf");
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = 297;
      doc.setFillColor(27, 58, 107);
      doc.rect(0, 0, pageW, 25, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Audit Log Report", 14, 16);

      let y = 40;
      const cols = [14, 60, 100, 140, 200];
      const headers = ["Timestamp", "User", "Role", "Action", "Details"];
      doc.setFillColor(240, 240, 245);
      doc.rect(10, y - 5, pageW - 20, 8, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(27, 58, 107);
      headers.forEach((h, i) => doc.text(h, cols[i], y));
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 40, 40);

      filteredAuditLogs.forEach((log) => {
        if (y > 190) {
          doc.addPage();
          y = 20;
          doc.setFillColor(240, 240, 245);
          doc.rect(10, y - 5, pageW - 20, 8, "F");
          doc.setFont("helvetica", "bold");
          doc.setTextColor(27, 58, 107);
          headers.forEach((h, i) => doc.text(h, cols[i], y));
          y += 6;
          doc.setFont("helvetica", "normal");
          doc.setTextColor(40, 40, 40);
        }
        doc.text(formatAuditTimestamp(log.created_at), cols[0], y);
        doc.text(log.user_name.substring(0, 20), cols[1], y);
        doc.text(log.user_role, cols[2], y);
        doc.text(log.action, cols[3], y);
        doc.text(log.details.substring(0, 50), cols[4], y);
        y += 6;
      });
      doc.save(`Quali-Audit-Log-${new Date().toISOString().split("T")[0]}.pdf`);
    } finally {
      setAuditExporting(null);
    }
  };

  const exportAuditCsv = async () => {
    setAuditExporting("csv");
    try {
      const escCsv = (val: string) => {
        if (val.includes(",") || val.includes('"') || val.includes("\n")) return `"${val.replace(/"/g, '""')}"`;
        return val;
      };
      const headers = ["Timestamp", "User", "Role", "Action", "Details"];
      const csvRows = filteredAuditLogs.map((l) => [
        formatAuditTimestamp(l.created_at), l.user_name, l.user_role, l.action, l.details,
      ]);
      const csvContent = [headers, ...csvRows].map(row => row.map(escCsv).join(",")).join("\n");
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Quali-Audit-Log-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setAuditExporting(null);
    }
  };

  const openEmployeeDetail = async (empName: string, empId: string) => {
    setSelectedEmployee({ name: empName, id: empId });
    setEmpLoading(true);
    const empRows = rows.filter((r) => r.employeeId === empId);
    setEmpHistory(
      empRows.map((r) => ({
        courseTitle: r.courseTitle, assignedDate: r.assignedDate, completionDate: r.completionDate,
        quizScore: r.quizScore, status: r.status, certificateId: r.certificateId, userId: r.userId, employeeId: r.employeeId,
      }))
    );
    setEmpLoading(false);
  };

  const handleDownloadCert = async (certId: string, userId: string | null) => {
    if (!userId) return;
    setDownloadingCertId(certId);
    try {
      await downloadCertificate(certId, userId);
    } catch (err: any) {
      console.error("Download failed:", err);
    } finally {
      setDownloadingCertId(null);
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
    { title: "Trained This Month", value: stats.trainedThisMonth, icon: Users, color: "text-primary" },
    { title: "Certificates Issued", value: stats.certificatesIssued, icon: Award, color: "text-accent" },
    { title: "Avg Quiz Score", value: `${stats.avgQuizScore}%`, icon: BarChart3, color: "text-primary" },
    { title: "Compliance Rate", value: `${stats.complianceRate}%`, icon: CheckCircle, color: "text-accent" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Compliance & Audit</h1>

      {/* Summary Cards */}
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

      <Tabs defaultValue="compliance" onValueChange={(v) => { if (v === "audit" && auditLogs.length === 0) fetchAuditLogs(); }}>
        <TabsList>
          <TabsTrigger value="compliance">Compliance Report</TabsTrigger>
          <TabsTrigger value="audit"><ClipboardList className="mr-1 h-4 w-4" />Audit Log</TabsTrigger>
        </TabsList>

        {/* ======= COMPLIANCE TAB ======= */}
        <TabsContent value="compliance" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={exportPdf} disabled={!!exporting}>
              {exporting === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
              Export PDF
            </Button>
            <Button variant="outline" onClick={exportExcel} disabled={!!exporting}>
              {exporting === "xlsx" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              Export Excel
            </Button>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search employee..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={filterDept} onValueChange={setFilterDept}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterCourse} onValueChange={setFilterCourse}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Course" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {courses.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {filteredRows.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">No data matches your filters.</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Course</TableHead>
                        <TableHead>Assigned</TableHead>
                        <TableHead>Completed</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Certificate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRows.map((row, idx) => (
                        <TableRow key={`${row.employeeId}-${row.courseId}-${idx}`}>
                          <TableCell>
                            <button className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => openEmployeeDetail(row.employeeName, row.employeeId)}>
                              {row.employeeName}
                            </button>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{row.department}</TableCell>
                          <TableCell>{row.courseTitle}</TableCell>
                          <TableCell className="text-muted-foreground">{row.assignedDate}</TableCell>
                          <TableCell className="text-muted-foreground">{row.completionDate || "—"}</TableCell>
                          <TableCell>{row.quizScore !== null ? `${Math.round(row.quizScore)}%` : "—"}</TableCell>
                          <TableCell>{statusBadge(row.status)}</TableCell>
                          <TableCell>
                            {row.certificateId ? (
                              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" disabled={downloadingCertId === row.certificateId} onClick={() => handleDownloadCert(row.certificateId!, row.userId)}>
                                {downloadingCertId === row.certificateId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                                {row.certificateId}
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex items-center justify-between border-t px-4 py-3">
                    <p className="text-sm text-muted-foreground">Showing {(page - 1) * ROWS_PER_PAGE + 1}–{Math.min(page * ROWS_PER_PAGE, filteredRows.length)} of {filteredRows.length}</p>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======= AUDIT LOG TAB ======= */}
        <TabsContent value="audit" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={exportAuditPdf} disabled={!!auditExporting}>
              {auditExporting === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
              Export PDF
            </Button>
            <Button variant="outline" onClick={exportAuditCsv} disabled={!!auditExporting}>
              {auditExporting === "csv" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              Export CSV
            </Button>
          </div>

          {/* Audit Filters */}
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search logs..." className="pl-9" value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} />
              </div>
              <Select value={auditFilter} onValueChange={(v) => { setAuditFilter(v); setAuditPage(1); }}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Action Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {AUDIT_ACTIONS.map((a) => <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[140px] text-left", !auditDateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {auditDateFrom ? format(auditDateFrom, "dd/MM/yy") : "From"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={auditDateFrom} onSelect={setAuditDateFrom} className="p-3 pointer-events-auto" /></PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[140px] text-left", !auditDateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {auditDateTo ? format(auditDateTo, "dd/MM/yy") : "To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={auditDateTo} onSelect={setAuditDateTo} className="p-3 pointer-events-auto" /></PopoverContent>
              </Popover>
              <Button variant="outline" size="sm" onClick={() => { fetchAuditLogs(); setAuditPage(1); }}>
                Apply
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {auditLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : filteredAuditLogs.length === 0 ? (
                <div className="py-12 text-center">
                  <ClipboardList className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No activity recorded yet. Actions will appear here as your team uses the platform.</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedAuditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-muted-foreground whitespace-nowrap">{formatAuditTimestamp(log.created_at)}</TableCell>
                          <TableCell className="font-medium">{log.user_name}</TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{log.user_role}</Badge></TableCell>
                          <TableCell><Badge variant="secondary">{log.action.replace(/_/g, " ")}</Badge></TableCell>
                          <TableCell className="text-muted-foreground max-w-[300px] truncate">{log.details}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex items-center justify-between border-t px-4 py-3">
                    <p className="text-sm text-muted-foreground">Showing {(auditPage - 1) * ROWS_PER_PAGE + 1}–{Math.min(auditPage * ROWS_PER_PAGE, filteredAuditLogs.length)} of {filteredAuditLogs.length}</p>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" disabled={auditPage <= 1} onClick={() => setAuditPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                      <Button variant="outline" size="sm" disabled={auditPage >= auditTotalPages} onClick={() => setAuditPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Employee Detail Modal */}
      <Dialog open={!!selectedEmployee} onOpenChange={(open) => !open && setSelectedEmployee(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedEmployee?.name} — Course History</DialogTitle>
          </DialogHeader>
          {empLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : empHistory.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No courses assigned.</p>
          ) : (
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Certificate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empHistory.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{h.courseTitle}</TableCell>
                      <TableCell className="text-muted-foreground">{h.assignedDate}</TableCell>
                      <TableCell className="text-muted-foreground">{h.completionDate || "—"}</TableCell>
                      <TableCell>{h.quizScore !== null ? `${Math.round(h.quizScore)}%` : "—"}</TableCell>
                      <TableCell>{statusBadge(h.status)}</TableCell>
                      <TableCell>
                        {h.certificateId ? (
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" disabled={downloadingCertId === h.certificateId} onClick={() => handleDownloadCert(h.certificateId!, h.userId)}>
                            {downloadingCertId === h.certificateId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                            Download
                          </Button>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReportsPage;
