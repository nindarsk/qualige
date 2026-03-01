import { supabase } from "@/integrations/supabase/client";

export async function downloadCertificate(certificateId: string, userId: string): Promise<void> {
  const filePath = `${userId}/${certificateId}.pdf`;
  
  const { data, error } = await supabase.storage
    .from("certificates")
    .createSignedUrl(filePath, 60 * 60);

  if (error || !data?.signedUrl) {
    throw new Error("Could not generate download link.");
  }

  const response = await fetch(data.signedUrl);
  if (!response.ok) throw new Error("Failed to fetch PDF.");
  
  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(
    new Blob([blob], { type: "application/pdf" })
  );

  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `Quali-Certificate-${certificateId}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
}
