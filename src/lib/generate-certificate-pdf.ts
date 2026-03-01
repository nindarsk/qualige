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

function buildPdf(data: CertificateData): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

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
  doc.text("CERTIFICATE OF COMPLETION", 148.5, 50, { align: "center" });

  // Subtitle
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("This certifies that", 148.5, 70, { align: "center" });

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
  doc.text("has successfully completed the training course", 148.5, 110, { align: "center" });

  // Course title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(27, 58, 107);
  doc.text(data.courseTitle, 148.5, 125, { align: "center" });

  // Organization
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Issued by: ${data.organizationName}`, 148.5, 142, { align: "center" });

  // Date and Certificate ID
  doc.setFontSize(10);
  doc.text(`Date: ${data.completionDate}`, 50, 165);
  doc.text(`Certificate ID: ${data.certificateId}`, 50, 172);

  // Score & authorized
  doc.text(`Score: ${Math.round(data.score)}%`, 200, 165);
  doc.text(`Authorized by: ${data.hrAdminName}`, 200, 172);

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text("Quali.ge — AI-powered Learning Management System for Financial Institutions", 148.5, 195, { align: "center" });

  return doc;
}

export async function generateAndUploadCertificate(
  courseId: string,
  userId: string,
  score: number
): Promise<{ certificateId: string; pdfUrl: string } | null> {
  try {
    // Get employee info
    const { data: emp } = await supabase
      .from("employees")
      .select("id, full_name, organization_id")
      .eq("user_id", userId)
      .single();
    if (!emp) return null;

    // Check if certificate already exists
    const { data: existing } = await supabase
      .from("certificates")
      .select("id, certificate_id, pdf_url")
      .eq("course_id", courseId)
      .eq("employee_id", emp.id)
      .maybeSingle();

    if (existing?.pdf_url) {
      return { certificateId: existing.certificate_id, pdfUrl: existing.pdf_url };
    }

    // Get course and org info
    const [courseRes, orgRes] = await Promise.all([
      supabase.from("courses").select("title, created_by").eq("id", courseId).single(),
      supabase.from("organizations").select("name").eq("id", emp.organization_id).single(),
    ]);

    // Get HR admin name
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
    const completionDate = new Date().toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });

    // Generate PDF
    const doc = buildPdf({
      employeeName: emp.full_name,
      courseTitle: courseRes.data?.title || "Course",
      organizationName: orgRes.data?.name || "Organization",
      completionDate,
      certificateId: certId,
      score,
      hrAdminName,
    });

    const pdfBlob = doc.output("blob");
    const filePath = `${userId}/${certId}.pdf`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("certificates")
      .upload(filePath, pdfBlob, { contentType: "application/pdf", upsert: true });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return null;
    }

    // Generate signed URL (1 year)
    const { data: urlData } = await supabase.storage
      .from("certificates")
      .createSignedUrl(filePath, 60 * 60 * 24 * 365);

    const pdfUrl = urlData?.signedUrl || null;

    if (existing) {
      // Update existing record
      await supabase
        .from("certificates")
        .update({ pdf_url: pdfUrl })
        .eq("id", existing.id);
    } else {
      // Insert new record
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
