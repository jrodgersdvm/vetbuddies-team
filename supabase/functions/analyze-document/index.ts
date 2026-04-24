import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { encode as encodeBase64 } from "https://deno.land/std@0.177.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const SYSTEM_PROMPT = `You are a veterinary care coordinator assistant for VetBuddies. Your role is to help pet owners understand their pet's veterinary documents in plain language. You do not diagnose or recommend treatment. You summarize what the document says, highlight anything the owner should follow up on with their vet, and flag any open questions worth raising. Always remind the owner that their Buddy and supervising DVM are available for follow-up.

Format your response in three short sections, each with a clear heading:

**What this document says**
2-4 plain-language sentences summarizing the document.

**What to follow up on**
A short bulleted list of items the owner should bring up with their Buddy or DVM (medications to ask about, symptoms to watch, recheck timelines). If nothing stands out, say "Nothing urgent — keep this on file."

**Open questions worth raising**
A short bulleted list of questions the owner could ask. If none, say "No open questions."

Close with one sentence reminding the owner their Buddy and supervising DVM are available for follow-up.

Keep the entire response under 250 words. Use simple, non-clinical language.`;

const cors = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      return json({ success: false, error: "ANTHROPIC_API_KEY not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ success: false, error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const documentId = body?.document_id;
    if (!documentId || typeof documentId !== "string") {
      return json({ success: false, error: "Missing document_id" }, 400);
    }

    // Load the document row (service-role bypass; we authorize manually below).
    const { data: doc, error: docErr } = await supabase
      .from("case_documents")
      .select("id, case_id, name, storage_path, mime_type, ai_summary")
      .eq("id", documentId)
      .single();
    if (docErr || !doc) return json({ success: false, error: "Document not found" }, 404);

    // Authorize: caller must be the case owner, assigned buddy, have case_access,
    // or be admin/practice_manager.
    const { data: appUser } = await supabase
      .from("users")
      .select("id, role")
      .eq("auth_id", user.id)
      .single();
    if (!appUser) return json({ success: false, error: "User profile not found" }, 403);

    const isStaff = ["admin", "practice_manager"].includes(appUser.role);
    let allowed = isStaff;
    if (!allowed) {
      const { data: caseRow } = await supabase
        .from("cases")
        .select("id, assigned_buddy_id, pets!inner(owner_id)")
        .eq("id", doc.case_id)
        .single();
      if (caseRow) {
        const ownerId = (caseRow as any).pets?.owner_id;
        if (ownerId === appUser.id) allowed = true;
        else if (caseRow.assigned_buddy_id === appUser.id) allowed = true;
      }
      if (!allowed) {
        const { data: access } = await supabase
          .from("case_access")
          .select("case_id")
          .eq("case_id", doc.case_id)
          .eq("user_id", appUser.id)
          .maybeSingle();
        if (access) allowed = true;
      }
    }
    if (!allowed) return json({ success: false, error: "Forbidden" }, 403);

    if (!doc.storage_path) {
      return json({
        success: false,
        error: "This document was uploaded before AI analysis was supported. Re-upload it to analyze.",
      }, 400);
    }
    if (!doc.mime_type || !SUPPORTED_MIME_TYPES.has(doc.mime_type)) {
      return json({
        success: false,
        error: `AI analysis only supports PDF, JPG, and PNG. This file is ${doc.mime_type || "unknown type"}.`,
      }, 400);
    }

    // Fetch the file via service-role from the case-files bucket.
    const { data: fileBlob, error: dlErr } = await supabase
      .storage
      .from("case-files")
      .download(doc.storage_path);
    if (dlErr || !fileBlob) {
      return json({ success: false, error: "Failed to fetch document from storage" }, 500);
    }

    const fileBytes = new Uint8Array(await fileBlob.arrayBuffer());
    if (fileBytes.length > MAX_FILE_BYTES) {
      return json({ success: false, error: "File too large for AI analysis (max 10MB)" }, 400);
    }

    const userContent: Array<Record<string, unknown>> = [];
    const base64Data = encodeBase64(fileBytes);
    if (doc.mime_type === "application/pdf") {
      userContent.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64Data },
      });
    } else {
      userContent.push({
        type: "image",
        source: { type: "base64", media_type: doc.mime_type, data: base64Data },
      });
    }
    userContent.push({
      type: "text",
      text: `Please summarize this veterinary document ("${doc.name}") in plain language for the pet's owner.`,
    });

    const claudeResponse = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error("Claude API error:", errText);
      await supabase.from("ai_debug_log").insert({
        source: "analyze-document",
        case_id: doc.case_id,
        status: `claude_${claudeResponse.status}`,
        detail: errText.slice(0, 4000),
        payload: { document_id: doc.id, mime_type: doc.mime_type },
      }).catch(() => {});
      return json({ success: false, error: "AI analysis failed. Please try again." }, 502);
    }

    const claudeJson = await claudeResponse.json();
    const summary: string = claudeJson?.content?.[0]?.text?.trim?.() || "";
    if (!summary) {
      return json({ success: false, error: "AI analysis returned an empty response" }, 502);
    }

    const analyzedAt = new Date().toISOString();
    const { error: updErr } = await supabase
      .from("case_documents")
      .update({ ai_summary: summary, ai_analyzed_at: analyzedAt })
      .eq("id", doc.id);
    if (updErr) {
      console.error("Failed to persist ai_summary:", updErr);
      return json({ success: true, summary, ai_analyzed_at: analyzedAt, persisted: false });
    }

    return json({ success: true, summary, ai_analyzed_at: analyzedAt, persisted: true });
  } catch (err) {
    console.error("analyze-document error:", err);
    return json({ success: false, error: (err as Error)?.message || "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: cors });
}
