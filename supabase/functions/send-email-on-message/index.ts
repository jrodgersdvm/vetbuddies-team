import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Email-side counterpart to send-push-notification. When a message is created
// in the client, the app fire-and-forgets this with the case_id + sender info.
// We resolve the recipient(s), filter by notification_preferences.email_messages
// and muted_case_ids, fetch their emails from public.users, and call send-email
// with a templated body.
//
// Input:
//   { case_id, sender_id, sender_role, sender_name, content_preview, message_id }
// Output:
//   { sent: number, total: number, errors: string[] }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = Deno.env.get("APP_URL") || "https://vetbuddies-team.netlify.app";

function esc(s: string): string {
  return String(s || "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;" }[c]!));
}

function emailHtml(opts: {
  recipientName: string;
  senderName: string;
  petName: string;
  preview: string;
  caseId: string;
}): string {
  const { recipientName, senderName, petName, preview, caseId } = opts;
  const link = `${APP_URL}/?case=${encodeURIComponent(caseId)}`;
  return `<div style="font-family:'DM Sans',Arial,sans-serif;font-size:15px;line-height:1.6;color:#3d3328;max-width:520px;">
    <p>Hi ${esc(recipientName) || "there"},</p>
    <p><strong>${esc(senderName)}</strong> just sent you a message about <strong>${esc(petName)}</strong> on Vet Buddies.</p>
    ${preview ? `<blockquote style="background:#f7faf7;border-left:3px solid #689562;padding:10px 14px;margin:14px 0;font-style:italic;color:#555;border-radius:0 6px 6px 0;">${esc(preview)}</blockquote>` : ""}
    <p style="margin-top:20px;"><a href="${link}" style="display:inline-block;background:#336026;color:white;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:600;">Open in app</a></p>
    <p style="font-size:12px;color:#888;margin-top:24px;">You can change notification preferences from your profile inside the app.</p>
    <p style="font-size:12px;color:#888;">— The Vet Buddies team</p>
  </div>`;
}

function emailText(opts: {
  recipientName: string;
  senderName: string;
  petName: string;
  preview: string;
  caseId: string;
}): string {
  const { recipientName, senderName, petName, preview, caseId } = opts;
  const link = `${APP_URL}/?case=${encodeURIComponent(caseId)}`;
  return `Hi ${recipientName || "there"},

${senderName} just sent you a message about ${petName} on Vet Buddies.

${preview ? `"${preview}"\n\n` : ""}Open in app: ${link}

You can change notification preferences from your profile inside the app.

— The Vet Buddies team`;
}

async function callSendEmail(payload: Record<string, unknown>): Promise<{ ok: boolean; status: number; body: unknown }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  // sb_secret_* keys must be passed via apikey header — Authorization Bearer
  // sends them through a JWT parser that rejects the format.
  const resp = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, body };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the caller via the bearer token.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_ANON_KEY") || ""
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      console.log("[email-on-message] unauthorized");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { case_id, sender_id, sender_role, sender_name, content_preview } = body;
    console.log(`[email-on-message] enter case_id=${case_id} sender_role=${sender_role} sender_id=${sender_id}`);

    if (!case_id || !sender_id) {
      return new Response(JSON.stringify({ error: "Missing case_id or sender_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const { data: caseData, error: caseErr } = await sb
      .from("cases")
      .select("assigned_buddy_id, pet_id, pets(owner_id, name)")
      .eq("id", case_id)
      .single();

    if (caseErr || !caseData) {
      console.log(`[email-on-message] case not found case_id=${case_id} err=${caseErr?.message}`);
      return new Response(JSON.stringify({ error: "Case not found", detail: caseErr?.message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const petName = (caseData as any).pets?.name || "your pet";

    let recipientIds: string[] = [];
    if (sender_role === "client") {
      if (caseData.assigned_buddy_id) recipientIds.push(caseData.assigned_buddy_id);
    } else {
      const ownerId = (caseData as any).pets?.owner_id;
      if (ownerId) recipientIds.push(ownerId);
    }

    // Don't email the sender themselves.
    recipientIds = recipientIds.filter((id) => id !== sender_id);

    console.log(`[email-on-message] recipients(pre-filter)=${JSON.stringify(recipientIds)}`);

    if (recipientIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, total: 0, message: "No recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter by notification_preferences: email_messages=true and case_id not muted.
    // Users with no preference row are treated as opted-in (matches the
    // post-2026-05-20 default).
    const { data: prefs } = await sb
      .from("notification_preferences")
      .select("user_id, email_messages, muted_case_ids")
      .in("user_id", recipientIds);

    const prefByUser = new Map<string, { email_messages: boolean; muted_case_ids: string[] }>();
    for (const p of (prefs || [])) {
      prefByUser.set(p.user_id, {
        email_messages: p.email_messages,
        muted_case_ids: Array.isArray(p.muted_case_ids) ? p.muted_case_ids : [],
      });
    }

    const allowedIds = recipientIds.filter((uid) => {
      const p = prefByUser.get(uid);
      if (!p) return true;
      if (!p.email_messages) return false;
      if (p.muted_case_ids.includes(case_id)) return false;
      return true;
    });

    console.log(`[email-on-message] recipients(post-pref-filter)=${JSON.stringify(allowedIds)}`);

    if (allowedIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, total: 0, message: "All recipients opted out" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up recipient emails + names.
    const { data: recipientRows, error: recipientErr } = await sb
      .from("users")
      .select("id, name, email")
      .in("id", allowedIds);

    if (recipientErr || !recipientRows) {
      console.log(`[email-on-message] user lookup failed err=${recipientErr?.message}`);
      return new Response(JSON.stringify({ error: "Recipient lookup failed", detail: recipientErr?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const preview = (content_preview || "").slice(0, 280);
    const subject = sender_role === "client"
      ? `New message from ${sender_name || "a client"} about ${petName}`
      : `New message about ${petName} on Vet Buddies`;

    let sent = 0;
    const errors: string[] = [];

    for (const r of recipientRows) {
      if (!r.email) {
        errors.push(`No email on file for user ${r.id}`);
        continue;
      }
      const html = emailHtml({
        recipientName: r.name || "",
        senderName: sender_name || "Your Vet Buddy",
        petName,
        preview,
        caseId: case_id,
      });
      const text = emailText({
        recipientName: r.name || "",
        senderName: sender_name || "Your Vet Buddy",
        petName,
        preview,
        caseId: case_id,
      });

      try {
        const result = await callSendEmail({
          to: r.email,
          subject,
          html,
          text,
          tags: ["new-message"],
        });
        if (result.ok && (result.body as any)?.ok) {
          sent++;
          console.log(`[email-on-message] sent to=${r.email} id=${(result.body as any).id}`);
        } else {
          const errMsg = (result.body as any)?.error || `HTTP ${result.status}`;
          errors.push(`send-email failed for ${r.email}: ${errMsg}`);
          console.log(`[email-on-message] send-email failed to=${r.email} err=${errMsg}`);
        }
      } catch (e) {
        const msg = (e as Error).message;
        errors.push(`Exception emailing ${r.email}: ${msg}`);
        console.log(`[email-on-message] exception to=${r.email} err=${msg}`);
      }
    }

    console.log(`[email-on-message] done sent=${sent} total=${recipientRows.length} errors=${errors.length}`);
    return new Response(JSON.stringify({ sent, total: recipientRows.length, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-email-on-message exception:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
