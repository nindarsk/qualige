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

// Cache the loaded font to avoid re-fetching
let cachedFontBase64: string | null = null;

async function loadNotoSansFont(): Promise<string> {
  if (cachedFontBase64) return cachedFontBase64;
  
  // Noto Sans supports Latin, Georgian, Cyrillic
  const fontUrl = "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosansgeorgian/NotoSansGeorgian%5Bwdth%2Cwght%5D.ttf";
  
  const response = await fetch(fontUrl);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  cachedFontBase64 = btoa(binary);
  return cachedFontBase64;
}

// Also load Noto Sans for Latin+Cyrillic (regular weight)
let cachedNotoSansBase64: string | null = null;

async function loadNotoSansRegularFont(): Promise<string> {
  if (cachedNotoSansBase64) return cachedNotoSansBase64;

  const fontUrl = "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosans/NotoSans%5Bital%2Cwdth%2Cwght%5D.ttf";

  const response = await fetch(fontUrl);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  cachedNotoSansBase64 = btoa(binary);
  return cachedNotoSansBase64;
}

async function registerFonts(doc: jsPDF, language: string): Promise<void> {
  if (language === "Georgian") {
    const fontData = await loadNotoSansFont();
    doc.addFileToVFS("NotoSansGeorgian.ttf", fontData);
    doc.addFont("NotoSansGeorgian.ttf", "NotoSansGeorgian", "normal");
    doc.addFont("NotoSansGeorgian.ttf", "NotoSansGeorgian", "bold");
  }
  
  if (language === "Russian" || language === "Georgian") {
    const fontData = await loadNotoSansRegularFont();
    doc.addFileToVFS("NotoSans.ttf", fontData);
    doc.addFont("NotoSans.ttf", "NotoSans", "normal");
    doc.addFont("NotoSans.ttf", "NotoSans", "bold");
  }
}

function getFontName(language: string, text: string): string {
  // Check if text contains Georgian characters
  const hasGeorgian = /[\u10A0-\u10FF\u2D00-\u2D2F\u1C90-\u1CBF]/.test(text);
  if (hasGeorgian) return "NotoSansGeorgian";
  
  if (language === "Russian") return "NotoSans";
  if (language === "Georgian") return "NotoSans"; // fallback for Latin text in Georgian certificates
  
  return "helvetica";
}

function setFont(doc: jsPDF, language: string, style: "normal" | "bold", text: string) {
  const fontName = getFontName(language, text);
  // Variable fonts registered as both normal and bold use same file, 
  // but jsPDF may not render bold differently — use "normal" style for variable fonts
  if (fontName === "helvetica") {
    doc.setFont(fontName, style);
  } else {
    doc.setFont(fontName, "normal");
  }
}

async function buildPdf(data: CertificateData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const lang = certText[data.language] || certText.English;
  const language = data.language;

  // Register fonts for non-Latin scripts
  await registerFonts(doc, language);

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
  setFont(doc, language, "bold", lang.title);
  doc.text(lang.title, 148.5, 50, { align: "center" });

  // Subtitle
  doc.setFontSize(14);
  setFont(doc, language, "normal", lang.subtitle);
  doc.setTextColor(100, 100, 100);
  doc.text(lang.subtitle, 148.5, 70, { align: "center" });

  // Employee name
  doc.setFontSize(28);
  setFont(doc, language, "bold", data.employeeName);
  doc.setTextColor(27, 58, 107);
  doc.text(data.employeeName, 148.5, 90, { align: "center" });

  // Gold underline
  doc.setDrawColor(201, 168, 76);
  doc.setLineWidth(1);
  doc.line(60, 95, 237, 95);

  // Course completion text
  doc.setFontSize(13);
  setFont(doc, language, "normal", lang.completedText);
  doc.setTextColor(100, 100, 100);
  doc.text(lang.completedText, 148.5, 110, { align: "center" });

  // Course title
  doc.setFontSize(18);
  setFont(doc, language, "bold", data.courseTitle);
  doc.setTextColor(27, 58, 107);
  doc.text(data.courseTitle, 148.5, 125, { align: "center" });

  // Organization
  doc.setFontSize(12);
  const issuedText = `${lang.issuedBy}: ${data.organizationName}`;
  setFont(doc, language, "normal", issuedText);
  doc.setTextColor(100, 100, 100);
  doc.text(issuedText, 148.5, 142, { align: "center" });

  // Date and Certificate ID
  doc.setFontSize(10);
  const dateText = `${lang.date}: ${data.completionDate}`;
  setFont(doc, language, "normal", dateText);
  doc.text(dateText, 50, 165);
  
  const certIdText = `${lang.certId}: ${data.certificateId}`;
  setFont(doc, language, "normal", certIdText);
  doc.text(certIdText, 50, 172);

  // Score & authorized
  const scoreText = `${lang.score}: ${Math.round(data.score)}%`;
  setFont(doc, language, "normal", scoreText);
  doc.text(scoreText, 200, 165);
  
  const authText = `${lang.authorizedBy}: ${data.hrAdminName}`;
  setFont(doc, language, "normal", authText);
  doc.text(authText, 200, 172);

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  setFont(doc, language, "normal", lang.footer);
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

    const doc = await buildPdf({
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
