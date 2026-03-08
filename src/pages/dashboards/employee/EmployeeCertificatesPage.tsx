import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { downloadCertificate } from "@/lib/download-certificate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, Download, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePageTitle } from "@/hooks/use-page-title";

interface Cert {
  id: string;
  certificate_id: string;
  issued_at: string;
  pdf_url: string | null;
  course: { title: string; category: string };
}

const EmployeeCertificatesPage = () => {
  usePageTitle("My Certificates");
  const { user } = useAuth();
  const { t } = useTranslation();
  const [certificates, setCertificates] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => { if (user) fetchCerts(); }, [user]);

  const fetchCerts = async () => {
    const { data: emp } = await supabase.from("employees").select("id").eq("user_id", user!.id).single();
    if (!emp) { setLoading(false); return; }
    const { data } = await supabase.from("certificates").select("id, certificate_id, issued_at, pdf_url, course_id").eq("employee_id", emp.id).order("issued_at", { ascending: false });
    if (!data?.length) { setCertificates([]); setLoading(false); return; }
    const enriched: Cert[] = await Promise.all(
      data.map(async (c) => {
        const { data: course } = await supabase.from("courses").select("title, category").eq("id", c.course_id).single();
        return { ...c, course: course || { title: "Unknown", category: "" } };
      })
    );
    setCertificates(enriched);
    setLoading(false);
  };

  const handleDownload = async (cert: Cert) => {
    if (!user) return;
    setDownloading(cert.id);
    try {
      await downloadCertificate(cert.certificate_id, user.id);
    } catch {
      alert(t("certificates.downloadFailed"));
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (certificates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Award className="mb-4 h-16 w-16 text-muted-foreground/50" />
        <h2 className="mb-2 text-xl font-bold text-foreground">{t("certificates.noCertificates")}</h2>
        <p className="text-muted-foreground">{t("certificates.noCertificatesDesc")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t("certificates.title")}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {certificates.map((cert) => (
          <Card key={cert.id}>
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
                  <Award className="h-8 w-8 text-accent" />
                </div>
              </div>
              <h3 className="text-center font-semibold text-foreground">{cert.course.title}</h3>
              <div className="mt-2 flex justify-center">
                <Badge variant="outline" className="text-xs">{cert.course.category}</Badge>
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                {t("certificates.issued", { date: new Date(cert.issued_at).toLocaleDateString() })}
              </p>
              <p className="text-center text-xs text-muted-foreground font-mono mt-1">{cert.certificate_id}</p>
              <Button variant="outline" size="sm" className="mt-4 w-full" disabled={downloading === cert.id} onClick={() => handleDownload(cert)}>
                {downloading === cert.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                {t("certificates.downloadPdf")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default EmployeeCertificatesPage;
