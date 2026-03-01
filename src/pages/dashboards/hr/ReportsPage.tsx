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
import { Loader2, Users, Award, BarChart3, CheckCircle, FileDown, FileSpreadsheet, Search, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { downloadCertificate } from "@/lib/download-certificate";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

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

const ROWS_PER_PAGE = 25;

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

  // Employee detail modal
  const [selectedEmployee, setSelectedEmployee] = useState<{ name: string; id: string } | null>(null);
  const [empHistory, setEmpHistory] = useState<EmployeeCourseHistory[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [downloadingCertId, setDownloadingCertId] = useState<string | null>(null);

  // Summary stats
  const [stats, setStats] = useState({
    trainedThisMonth: 0,
    certificatesIssued: 0,
    avgQuizScore: 0,
    complianceRate: 0,
  });

  useEffect(() => {
    if (organizationId) fetchReportData();
  }, [organizationId]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // Get all assignments with employee, course, progress, quiz, and certificate data
      const { data: assignments } = await supabase
        .from("course_assignments")
        .select("id, course_id, employee_id, assigned_at, status, due_date")
        .order("assigned_at", { ascending: false });

      if (!assignments?.length) {
        setLoading(false);
        return;
      }

      // Get unique employee and course IDs
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

      // Build quiz score map (best score per employee+course)
      const quizMap = new Map<string, number>();
      (quizRes.data || []).forEach((q) => {
        const key = `${q.employee_id}_${q.course_id}`;
        const existing = quizMap.get(key);
        if (!existing || Number(q.score) > existing) quizMap.set(key, Number(q.score));
      });

      // Build cert map
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

      // Summary stats
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const completedThisMonth = reportRows.filter(
        (r) => r.status === "completed" && r.completionDate && new Date(r.completionDate) >= monthStart
      ).length;

      const allScores = reportRows.filter((r) => r.quizScore !== null).map((r) => r.quizScore!);
      const avgScore = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;

      const totalCerts = reportRows.filter((r) => r.certificateId).length;

      // Compliance: employees who completed ALL assigned courses / total employees
      const empAssignments = new Map<string, { total: number; completed: number }>();
      reportRows.forEach((r) => {
        const entry = empAssignments.get(r.employeeId) || { total: 0, completed: 0 };
        entry.total++;
        if (r.status === "completed") entry.completed++;
        empAssignments.set(r.employeeId, entry);
      });
      const fullyCompliant = [...empAssignments.values()].filter((e) => e.total > 0 && e.completed === e.total).length;
      const complianceRate = empAssignments.size > 0 ? Math.round((fullyCompliant / empAssignments.size) * 100) : 0;

      setStats({
        trainedThisMonth: completedThisMonth,
        certificatesIssued: totalCerts,
        avgQuizScore: Math.round(avgScore),
        complianceRate,
      });
    } catch (err) {
      console.error("Reports error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Unique departments and courses for filter options
  const departments = useMemo(() => [...new Set(rows.map((r) => r.department).filter((d) => d !== "—"))], [rows]);
  const courses = useMemo(() => [...new Set(rows.map((r) => r.courseTitle))], [rows]);

  // Filtered rows
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

  // PDF Export
  const exportPdf = async () => {
    setExporting("pdf");
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = 297;

      // Header
      doc.setFillColor(27, 58, 107);
      doc.rect(0, 0, pageW, 25, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Training Compliance Report", 14, 16);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(organizationName || "Organization", pageW - 14, 16, { align: "right" });

      // Date range
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(9);
      doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 14, 33);

      // Summary stats
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

      // Table header
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

      // Footer
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

  // Excel Export
  const exportExcel = async () => {
    setExporting("xlsx");
    try {
      const wsData = [
        ["Training Compliance Report"],
        [organizationName || "Organization"],
        [`Generated: ${new Date().toLocaleDateString()}`],
        [],
        ["Summary"],
        [`Trained this month: ${stats.trainedThisMonth}`, `Certificates: ${stats.certificatesIssued}`, `Avg Score: ${stats.avgQuizScore}%`, `Compliance: ${stats.complianceRate}%`],
        [],
        ["Employee", "Department", "Course", "Assigned Date", "Completion Date", "Quiz Score", "Status", "Certificate ID"],
        ...filteredRows.map((r) => [
          r.employeeName,
          r.department,
          r.courseTitle,
          r.assignedDate,
          r.completionDate || "—",
          r.quizScore !== null ? `${Math.round(r.quizScore)}%` : "—",
          r.status,
          r.certificateId || "—",
        ]),
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws["!cols"] = [{ wch: 25 }, { wch: 18 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 22 }];
      XLSX.utils.book_append_sheet(wb, ws, "Compliance Report");
      XLSX.writeFile(wb, `Quali-Compliance-Report-${new Date().toISOString().split("T")[0]}.xlsx`);
    } finally {
      setExporting(null);
    }
  };

  // Employee detail modal
  const openEmployeeDetail = async (empName: string, empId: string) => {
    setSelectedEmployee({ name: empName, id: empId });
    setEmpLoading(true);
    setEmpHistory([]);

    const empRows = rows.filter((r) => r.employeeId === empId);
    setEmpHistory(
      empRows.map((r) => ({
        courseTitle: r.courseTitle,
        assignedDate: r.assignedDate,
        completionDate: r.completionDate,
        quizScore: r.quizScore,
        status: r.status,
        certificateId: r.certificateId,
        userId: r.userId,
        employeeId: r.employeeId,
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Compliance Reports</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPdf} disabled={!!exporting}>
            {exporting === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            Export PDF
          </Button>
          <Button variant="outline" onClick={exportExcel} disabled={!!exporting}>
            {exporting === "xlsx" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
            Export Excel
          </Button>
        </div>
      </div>

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

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search employee..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterCourse} onValueChange={setFilterCourse}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Course" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Completion Table */}
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
                        <button
                          className="font-medium text-primary underline-offset-2 hover:underline"
                          onClick={() => openEmployeeDetail(row.employeeName, row.employeeId)}
                        >
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
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            disabled={downloadingCertId === row.certificateId}
                            onClick={() => handleDownloadCert(row.certificateId!, row.userId)}
                          >
                            {downloadingCertId === row.certificateId ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Download className="h-3 w-3" />
                            )}
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

              {/* Pagination */}
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * ROWS_PER_PAGE + 1}–{Math.min(page * ROWS_PER_PAGE, filteredRows.length)} of {filteredRows.length}
                </p>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Employee Detail Modal */}
      <Dialog open={!!selectedEmployee} onOpenChange={(open) => !open && setSelectedEmployee(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedEmployee?.name} — Course History</DialogTitle>
          </DialogHeader>
          {empLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
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
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            disabled={downloadingCertId === h.certificateId}
                            onClick={() => handleDownloadCert(h.certificateId!, h.userId)}
                          >
                            {downloadingCertId === h.certificateId ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Download className="h-3 w-3" />
                            )}
                            Download
                          </Button>
                        ) : (
                          "—"
                        )}
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
