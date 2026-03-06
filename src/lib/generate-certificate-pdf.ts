import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

interface CertificateData {
  employeeName: string;
  courseTitle: string;
  organizationName: string;
  completionDate: string;
  certificateId: string;
  score: number;
  hrAdminName: string;
  language: string;
}

function generateCertificateId(): string {
  const year = new Date().getFullYear();
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `QUALI-${year}-${code}`;
}

// Language-specific certificate text
const certText: Record<string, {
  title: string;
  subtitle: string;
  completedText: string;
  issuedBy: string;
  authorizedBy: string;
  score: string;
  date: string;
  certId: string;
  footer: string;
}> = {
  English: {
    title: "CERTIFICATE OF COMPLETION",
    subtitle: "This certifies that",
    completedText: "has successfully completed the training course",
    issuedBy: "Issued by",
    authorizedBy: "Authorized by",
    score: "Score",
    date: "Date",
    certId: "Certificate ID",
    footer: "Quali.ge — AI-powered Learning Management System for Financial Institutions",
  },
  Georgian: {
    title: "კვალიფიკაციის სერტიფიკატი",
    subtitle: "ამით დასტურდება, რომ",
    completedText: "წარმატებით დაასრულა სასწავლო კურსი",
    issuedBy: "გაცემულია",
    authorizedBy: "დამტკიცებულია",
    score: "ქულა",
    date: "თარიღი",
    certId: "სერტიფიკატის ID",
    footer: "Quali.ge — AI-ზე დაფუძნებული სასწავლო მართვის სისტემა ფინანსური ინსტიტუტებისთვის",
  },
  Russian: {
    title: "СЕРТИФИКАТ О ПРОХОЖДЕНИИ",
    subtitle: "Настоящим подтверждается, что",
    completedText: "успешно завершил(а) учебный курс",
    issuedBy: "Выдан",
    authorizedBy: "Утверждён",
    score: "Балл",
    date: "Дата",
    certId: "ID сертификата",
    footer: "Quali.ge — Система управления обучением на основе ИИ для финансовых учреждений",
  },
};

function buildPdf(data: CertificateData): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const lang = certText[data.language] || certText.English;

  // Background
  doc.setFillColor(27, 58, 107);
  doc.rect(0, 0, 297, 210, "F");
  doc.setFillColor(255, 255, 255);
  doc.rect(10, 10, 277, 190, "F");

  // Gold border
  doc.setDrawColor(201, 168, 76);
  doc.setLineWidth(2);
  doc.rect(14, 14, 269, 182);

  // Header
  doc.setTextColor(27, 58, 107);
  doc.setFontSize(32);
  doc.setFont("helvetica", "bold");
  doc.text(lang.title, 148.5, 50, { align: "center" });

  // Subtitle
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(lang.subtitle, 148.5, 70, { align: "center" });

  // Employee name
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(27, 58, 107);
  doc.text(data.employeeName, 148.5, 90, { align: "center" });

  // Gold underline
  doc.setDrawColor(201, 168, 76);
  doc.setLineWidth(1);
  doc.line(60, 95, 237, 95);

  // Course completion text
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(lang.completedText, 148.5, 110, { align: "center" });

  // Course title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(27, 58, 107);
  doc.text(data.courseTitle, 148.5, 125, { align: "center" });

  // Organization
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`${lang.issuedBy}: ${data.organizationName}`, 148.5, 142, { align: "center" });

  // Date and Certificate ID
  doc.setFontSize(10);
  doc.text(`${lang.date}: ${data.completionDate}`, 50, 165);
  doc.text(`${lang.certId}: ${data.certificateId}`, 50, 172);

  // Score & authorized
  doc.text(`${lang.score}: ${Math.round(data.score)}%`, 200, 165);
  doc.text(`${lang.authorizedBy}: ${data.hrAdminName}`, 200, 172);

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(lang.footer, 148.5, 195, { align: "center" });

  return doc;
}

export async function generateAndUploadCertificate(
  courseId: string,
  userId: string,
  score: number
): Promise<{ certificateId: string; pdfUrl: string } | null> {
  try {
    const { data: emp } = await supabase
      .from("employees")
      .select("id, full_name, organization_id")
      .eq("user_id", userId)
      .single();
    if (!emp) return null;

    const { data: existing } = await supabase
      .from("certificates")
      .select("id, certificate_id, pdf_url")
      .eq("course_id", courseId)
      .eq("employee_id", emp.id)
      .maybeSingle();

    if (existing?.pdf_url) {
      return { certificateId: existing.certificate_id, pdfUrl: existing.pdf_url };
    }

    const [courseRes, orgRes] = await Promise.all([
      supabase.from("courses").select("title, created_by, language").eq("id", courseId).single(),
      supabase.from("organizations").select("name").eq("id", emp.organization_id).single(),
    ]);

    let hrAdminName = "HR Administrator";
    if (courseRes.data?.created_by) {
      const { data: hrProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", courseRes.data.created_by)
        .single();
      if (hrProfile) hrAdminName = hrProfile.full_name;
    }

    const certId = existing?.certificate_id || generateCertificateId();
    const courseLanguage = courseRes.data?.language || "English";
    const completionDate = new Date().toLocaleDateString(
      courseLanguage === "Georgian" ? "ka-GE" : courseLanguage === "Russian" ? "ru-RU" : "en-US",
      { year: "numeric", month: "long", day: "numeric" }
    );

    const doc = buildPdf({
      employeeName: emp.full_name,
      courseTitle: courseRes.data?.title || "Course",
      organizationName: orgRes.data?.name || "Organization",
      completionDate,
      certificateId: certId,
      score,
      hrAdminName,
      language: courseLanguage,
    });

    const pdfBlob = doc.output("blob");
    const filePath = `${userId}/${certId}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("certificates")
      .upload(filePath, pdfBlob, { contentType: "application/pdf", upsert: true });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return null;
    }

    const { data: urlData } = await supabase.storage
      .from("certificates")
      .createSignedUrl(filePath, 60 * 60 * 24 * 365);

    const pdfUrl = urlData?.signedUrl || null;

    if (existing) {
      await supabase.from("certificates").update({ pdf_url: pdfUrl }).eq("id", existing.id);
    } else {
      await supabase.from("certificates").insert({
        course_id: courseId,
        employee_id: emp.id,
        organization_id: emp.organization_id,
        certificate_id: certId,
        pdf_url: pdfUrl,
      });
    }

    return { certificateId: certId, pdfUrl: pdfUrl || "" };
  } catch (err) {
    console.error("Certificate generation error:", err);
    return null;
  }
}

export async function getSignedCertificateUrl(storagePath: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from("certificates")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);
  return data?.signedUrl || null;
}
