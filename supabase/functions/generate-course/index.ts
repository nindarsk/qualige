import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import pdf from "npm:pdf-parse@1.1.1";
import mammoth from "npm:mammoth@1.8.0";
import officeparser from "npm:officeparser@4.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_CATEGORIES = ["Compliance", "Safety", "HR", "IT", "Operations", "Finance", "Sales", "Marketing", "Leadership", "Other", "General"];
const ALLOWED_LANGUAGES = ["English", "French", "Spanish", "German", "Arabic", "Portuguese", "Chinese", "Japanese", "Korean", "Hindi", "Dutch", "Italian", "Russian", "Turkish", "Georgian"];

function validateInput(input: { filePath?: string; youtubeUrl?: string; category?: string; language?: string }) {
  if (!input.filePath && !input.youtubeUrl) throw new Error("No file or YouTube URL provided");
  if (input.filePath && typeof input.filePath !== "string") throw new Error("Invalid file path");
  if (input.filePath && input.filePath.length > 500) throw new Error("File path too long");
  if (input.youtubeUrl && typeof input.youtubeUrl !== "string") throw new Error("Invalid YouTube URL");
  if (input.youtubeUrl && input.youtubeUrl.length > 500) throw new Error("YouTube URL too long");
  if (input.category && !ALLOWED_CATEGORIES.includes(input.category)) throw new Error("Invalid category");
  if (input.language && !ALLOWED_LANGUAGES.includes(input.language)) throw new Error("Invalid language");
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/, /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/, /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/, /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) { const m = url.match(re); if (m) return m[1]; }
  return null;
}

function cleanTranscript(xml: string): string {
  let text = xml.replace(/<[^>]+>/g, " ");
  text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
  text = text.replace(/\[Music\]/gi, "").replace(/\[Applause\]/gi, "").replace(/\[Laughter\]/gi, "");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function extractVideoMetadata(html: string): { title: string; description: string } {
  let title = ""; let description = "";
  const titleMatch = html.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (titleMatch) title = titleMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
  if (!title) { const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/) || html.match(/<title>([^<]*)<\/title>/); if (ogTitle) title = ogTitle[1]; }
  const descMatch = html.match(/"shortDescription"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (descMatch) description = descMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
  if (!description) { const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/); if (ogDesc) description = ogDesc[1]; }
  return { title, description };
}

async function fetchYouTubeTranscript(videoId: string): Promise<{ text: string; source: "transcript" | "metadata" }> {
  const endpoints = [
    `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`,
    `https://video.google.com/timedtext?lang=en&v=${videoId}`,
    `https://www.youtube.com/api/timedtext?v=${videoId}`,
  ];
  for (const url of endpoints) {
    try { const resp = await fetch(url); if (!resp.ok) continue; const xml = await resp.text(); if (!xml || xml.trim().length < 50) continue; const cleaned = cleanTranscript(xml); if (cleaned.length > 50) return { text: cleaned, source: "transcript" }; } catch { continue; }
  }
  let lastHtml = "";
  const pageUrls = [`https://www.youtube.com/watch?v=${videoId}`, `https://m.youtube.com/watch?v=${videoId}`];
  for (const pageUrl of pageUrls) {
    try {
      const pageResp = await fetch(pageUrl, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Accept-Language": "en-US,en;q=0.9", "Accept": "text/html,application/xhtml+xml" } });
      if (!pageResp.ok) continue;
      const html = await pageResp.text(); lastHtml = html;
      if (html.includes("captionTracks")) {
        const captionMatch = html.match(/"captionTracks":\s*\[.*?\]/s);
        if (captionMatch) {
          const baseUrlMatches = captionMatch[0].matchAll(/"baseUrl"\s*:\s*"(.*?)"/g);
          for (const urlMatch of baseUrlMatches) {
            try { const captionUrl = urlMatch[1].replace(/\\u0026/g, "&").replace(/\\"/g, '"'); const captionResp = await fetch(captionUrl); if (!captionResp.ok) { await captionResp.text(); continue; } const xml = await captionResp.text(); const cleaned = cleanTranscript(xml); if (cleaned.length > 50) return { text: cleaned, source: "transcript" }; } catch { continue; }
          }
        }
      }
    } catch { continue; }
  }
  if (lastHtml) { const meta = extractVideoMetadata(lastHtml); if (meta.title) return { text: `Video Title: ${meta.title}\n\nVideo Description: ${meta.description || "No description available."}`, source: "metadata" }; }
  return { text: "", source: "transcript" };
}

async function extractText(fileData: Blob, fileName: string): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const arrayBuffer = await fileData.arrayBuffer();
  if (ext === "txt") return new TextDecoder("utf-8").decode(arrayBuffer);
  if (ext === "pdf") { const result = await pdf(new Uint8Array(arrayBuffer)); return result.text; }
  if (ext === "docx") { const result = await mammoth.extractRawText({ arrayBuffer }); return result.value; }
  if (ext === "pptx") { return await officeparser.parseOfficeAsync(new Uint8Array(arrayBuffer)); }
  return new TextDecoder("utf-8", { fatal: false }).decode(arrayBuffer);
}

async function generateSlidesForModule(moduleContent: string, moduleTitle: string, lovableApiKey: string): Promise<any[]> {
  try {
    const slidePrompt = `Split this training module content into 4-6 presentation slides. Each slide should have a clear title, 3-5 bullet points maximum, and a suggested image description for visual illustration.
Return JSON only:
{
  "slides": [
    {
      "slide_number": 1,
      "title": "string",
      "bullets": ["string", "string", "string"],
      "image_prompt": "Professional business illustration showing [specific concept]. Clean, minimal, suitable for corporate training. No text in image."
    }
  ]
}

Module title: ${moduleTitle}
Module content to split:
${moduleContent}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an expert presentation designer. Create clear, concise slides from training content. Return valid JSON only." },
          { role: "user", content: slidePrompt },
        ],
        temperature: 0.5,
      }),
    });

    if (!resp.ok) { console.error("Slide generation failed:", resp.status); return []; }
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return [];

    let cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return [];
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(cleaned);
    return parsed.slides || [];
  } catch (e) {
    console.error("Slide generation error:", e);
    return [];
  }
}

async function generateModuleImage(imagePrompt: string, courseId: string, moduleNumber: number, lovableApiKey: string, supabaseAdmin: any): Promise<string | null> {
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          { role: "user", content: `${imagePrompt} Style: clean corporate illustration, deep blue and gold color scheme, professional business environment, no text, no letters, no words in the image.` },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!resp.ok) { console.error("Image generation failed:", resp.status); return null; }
    const data = await resp.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl || !imageUrl.startsWith("data:image")) return null;

    // Extract base64 data
    const base64Data = imageUrl.split(",")[1];
    if (!base64Data) return null;

    // Convert base64 to Uint8Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const imagePath = `${courseId}/module-${moduleNumber}.png`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("course-images")
      .upload(imagePath, bytes, { contentType: "image/png", upsert: true });

    if (uploadError) { console.error("Image upload error:", uploadError); return null; }

    const { data: urlData } = await supabaseAdmin.storage
      .from("course-images")
      .createSignedUrl(imagePath, 60 * 60 * 24 * 365); // 1 year

    return urlData?.signedUrl || null;
  } catch (e) {
    console.error("Image generation error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "hr_admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: Only HR administrators can generate courses." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { filePath, youtubeUrl, category, language } = body;
    validateInput({ filePath, youtubeUrl, category, language });

    let textContent = "";

    if (filePath) {
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage.from("course-materials").download(filePath);
      if (downloadError) {
        console.error("File download failed:", downloadError);
        return new Response(JSON.stringify({ error: "Failed to download the uploaded file. Please try uploading again." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      try { textContent = await extractText(fileData, filePath); } catch (extractErr) {
        console.error("Text extraction error:", extractErr);
        return new Response(JSON.stringify({ error: "Could not read document content. Please ensure the file is not password protected and try again." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const cleaned = textContent.replace(/\s+/g, " ").trim();
      if (!cleaned || cleaned.length < 100) {
        return new Response(JSON.stringify({ error: "Could not read document content. Please ensure the file is not password protected and try again." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const words = textContent.split(/\s+/);
      if (words.length > 12000) textContent = words.slice(0, 12000).join(" ");
    } else if (youtubeUrl) {
      const videoId = extractVideoId(youtubeUrl);
      if (!videoId) return new Response(JSON.stringify({ error: "Invalid YouTube URL. Please provide a valid YouTube video link." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const result = await fetchYouTubeTranscript(videoId);
      if (!result.text || result.text.length < 20) return new Response(JSON.stringify({ error: "Could not extract transcript from this YouTube video." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      textContent = result.text;
      const words = textContent.split(/\s+/);
      if (words.length > 12000) textContent = words.slice(0, 12000).join(" ");
    }

    const { data: orgData } = await supabaseAdmin.from("profiles").select("organization_id").eq("user_id", user.id).single();
    if (!orgData?.organization_id) throw new Error("User has no organization");

    const systemPrompt = `You are an expert instructional designer. Your ONLY job is to create a training course based EXCLUSIVELY on the document content provided below. Do NOT use any external knowledge. Do NOT add information that is not present in the document. Every module, every quiz question, and every learning objective must be directly derived from the provided text. Stay strictly within the boundaries of the provided content.

You must respond with valid JSON matching this exact structure:
{
  "course_title": "string",
  "course_description": "string (2-3 sentences)",
  "estimated_duration_minutes": number,
  "learning_objectives": ["string", "string", "string"],
  "modules": [
    {
      "module_number": number,
      "module_title": "string",
      "content": "string (detailed lesson content minimum 200 words)",
      "key_points": ["string", "string", "string"]
    }
  ],
  "quiz": [
    {
      "question_number": number,
      "question": "string",
      "options": ["A. string", "B. string", "C. string", "D. string"],
      "correct_answer": "A or B or C or D",
      "explanation": "string explaining why this answer is correct"
    }
  ]
}

Generate minimum 3 modules and maximum 8 modules based on content length.
Generate minimum 5 quiz questions and maximum 15 based on content complexity.
The course language should be: ${language || "English"}.
The course category is: ${category || "General"}.`;

    const userMessage = `Here is the complete document content to base the course on:\n\n${textContent}\n\nCreate a training course based EXCLUSIVELY on this content. Do not deviate from the topics covered in this document.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }], temperature: 0.7 }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResponse.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "Failed to generate course content. Please try again." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) return new Response(JSON.stringify({ error: "Failed to generate course content. Please try again." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let courseData;
    try {
      let cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const jsonStart = cleaned.search(/[\{\[]/);
      const jsonEnd = cleaned.lastIndexOf(jsonStart !== -1 && cleaned[jsonStart] === '[' ? ']' : '}');
      if (jsonStart === -1 || jsonEnd === -1) throw new Error("No JSON found");
      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
      try { courseData = JSON.parse(cleaned); } catch { cleaned = cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, ""); courseData = JSON.parse(cleaned); }
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr);
      return new Response(JSON.stringify({ error: "Failed to process AI response. Please try again." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: course, error: courseError } = await supabaseAdmin.from("courses").insert({
      organization_id: orgData.organization_id,
      title: courseData.course_title,
      description: courseData.course_description,
      category: category || "Other",
      language: language || "English",
      duration_minutes: courseData.estimated_duration_minutes,
      learning_objectives: courseData.learning_objectives,
      status: "draft",
      source_file_path: filePath || null,
      source_youtube_url: youtubeUrl || null,
      created_by: user.id,
    }).select().single();

    if (courseError) {
      console.error("Course insert error:", courseError);
      return new Response(JSON.stringify({ error: "Failed to save course. Please try again." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Generate slides and images for each module
    if (courseData.modules?.length) {
      const modulesWithSlides = [];

      for (const m of courseData.modules) {
        const moduleNumber = m.module_number ?? (courseData.modules.indexOf(m) + 1);
        const moduleTitle = m.module_title || m.title || `Module ${moduleNumber}`;
        const moduleContent = m.content || "";

        // Generate slides for this module
        const slides = await generateSlidesForModule(moduleContent, moduleTitle, lovableApiKey);

        // Generate image using the first slide's image_prompt (or a default)
        let imageUrl: string | null = null;
        const imagePrompt = slides.length > 0 && slides[0].image_prompt
          ? slides[0].image_prompt
          : `Professional corporate training illustration for module about ${moduleTitle}. Clean, minimal design.`;

        imageUrl = await generateModuleImage(imagePrompt, course.id, moduleNumber, lovableApiKey, supabaseAdmin);

        modulesWithSlides.push({
          course_id: course.id,
          module_number: moduleNumber,
          title: moduleTitle,
          content: moduleContent,
          key_points: m.key_points || [],
          slides: slides.length > 0 ? slides : null,
          image_url: imageUrl,
        });
      }

      const { error: modError } = await supabaseAdmin.from("course_modules").insert(modulesWithSlides);
      if (modError) console.error("Module insert error:", modError);
    }

    if (courseData.quiz?.length) {
      const questions = courseData.quiz
        .filter((q: any) => q.question && q.options && q.correct_answer)
        .map((q: any, i: number) => ({
          course_id: course.id,
          question_number: q.question_number ?? (i + 1),
          question: q.question,
          options: q.options,
          correct_answer: q.correct_answer,
          explanation: q.explanation || "",
        }));
      if (questions.length > 0) {
        const { error: quizError } = await supabaseAdmin.from("quiz_questions").insert(questions);
        if (quizError) console.error("Quiz insert error:", quizError);
      }
    }

    return new Response(JSON.stringify({ courseId: course.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-course error:", e);
    return new Response(JSON.stringify({ error: "An unexpected error occurred. Please try again." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
