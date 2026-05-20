import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Reusable transactional email sender.
// Used by feature #5 (escalations) and intended to be reused by #6 (messaging),
// #8 (transactional email), #11 (payment dunning), #19 (weekly digests).
//
// Input:
//   { to: string | string[], subject: string, html: string, text?: string,
//     from?: string, tags?: string[], replyTo?: string }
// Output:
//   { ok: true, id: string } on success
//   { ok: false, error: string } on failure
//
// Requires env var RESEND_API_KEY. If missing, returns a clear error but 200s
// so callers can continue gracefully during setup.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const DEFAULT_FROM = Deno.env.get("DEFAULT_EMAIL_FROM")
  || "Vet Buddies <no-reply@rodgersvetbuddies.com>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { to, subject, html, text, from, tags, replyTo } = body;

    if (!to || !subject || !html) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Missing required fields: to, subject, html",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      console.log("[send-email] RESEND_API_KEY not configured — skipping send");
      return new Response(JSON.stringify({
        ok: false,
        error: "RESEND_API_KEY not configured",
        skipped: true,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: Record<string, unknown> = {
      from: from || DEFAULT_FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    };
    if (text) payload.text = text;
    if (replyTo) payload.reply_to = replyTo;
    if (tags && Array.isArray(tags) && tags.length > 0) {
      payload.tags = tags.map((t) => ({ name: "category", value: String(t) }));
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const respBody = await resp.json();

    if (!resp.ok) {
      console.log(`[send-email] resend rejected status=${resp.status} body=${JSON.stringify(respBody)}`);
      return new Response(JSON.stringify({
        ok: false,
        error: `Resend error: ${respBody?.message || "unknown"}`,
        status: resp.status,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[send-email] sent id=${respBody.id} to=${Array.isArray(to) ? to.join(",") : to}`);

    return new Response(JSON.stringify({
      ok: true,
      id: respBody.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-email] exception:", e);
    return new Response(JSON.stringify({
      ok: false,
      error: (e as Error).message,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
