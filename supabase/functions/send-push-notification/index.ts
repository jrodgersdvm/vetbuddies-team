import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = "BJJCTmZAXDO_VN6svOa-AqC0990KFAo2cqaZAWjJpKsnSm7se6JFwsITHbuAv4OLYr3bsV36m317tCAEdRDitAg";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = "mailto:rodgersvetcare@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function base64UrlDecode(str: string): Uint8Array {
  const padding = "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { result.set(a, offset); offset += a.length; }
  return result;
}

async function createVapidJwt(endpoint: string): Promise<string> {
  const audience = new URL(endpoint).origin;
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: VAPID_SUBJECT,
  };
  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const rawPrivateKey = base64UrlDecode(VAPID_PRIVATE_KEY);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: base64UrlEncode(rawPrivateKey),
    x: base64UrlEncode(base64UrlDecode(VAPID_PUBLIC_KEY).slice(1, 33)),
    y: base64UrlEncode(base64UrlDecode(VAPID_PUBLIC_KEY).slice(33, 65)),
  };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsignedToken)));

  return `${unsignedToken}.${base64UrlEncode(signature)}`;
}

async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const enc = new TextEncoder();

  const localKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", localKeyPair.publicKey));

  const subscriberPubBytes = base64UrlDecode(p256dhKey);
  const subscriberPubKey = await crypto.subtle.importKey("raw", subscriberPubBytes, { name: "ECDH", namedCurve: "P-256" }, false, []);

  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: subscriberPubKey }, localKeyPair.privateKey, 256));

  const authBytes = base64UrlDecode(authSecret);

  const authInfo = concatBytes(enc.encode("WebPush: info\0"), subscriberPubBytes, localPublicKeyRaw);
  const ikmKey = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveBits"]);
  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: authBytes, info: authInfo }, ikmKey, 256)
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const prkKey = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const cekBits = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: enc.encode("Content-Encoding: aes128gcm\0") }, prkKey, 128)
  );
  const nonceBits = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: enc.encode("Content-Encoding: nonce\0") }, prkKey, 96)
  );

  const cekCryptoKey = await crypto.subtle.importKey("raw", cekBits, "AES-GCM", false, ["encrypt"]);
  const paddedPayload = concatBytes(new Uint8Array(2), enc.encode(payload));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonceBits }, cekCryptoKey, paddedPayload));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  const idlen = new Uint8Array([65]);
  const ciphertext = concatBytes(salt, rs, idlen, localPublicKeyRaw, encrypted);

  return { ciphertext, salt, localPublicKey: localPublicKeyRaw };
}

async function sendWebPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payloadObj: Record<string, unknown>
): Promise<{ ok: boolean; status: number; body: string }> {
  const payloadStr = JSON.stringify(payloadObj);

  const { ciphertext } = await encryptPayload(payloadStr, p256dh, auth);

  const jwt = await createVapidJwt(endpoint);
  const vapidAuth = `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`;

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
      "Authorization": vapidAuth,
    },
    body: ciphertext,
  });

  const body = await resp.text();
  return { ok: resp.ok, status: resp.status, body };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_ANON_KEY") || ""
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      console.log("[push] unauthorized");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { sender_id, sender_role, case_id, content, sender_name } = await req.json();
    console.log(`[push] enter sender_role=${sender_role} case_id=${case_id} sender_id=${sender_id}`);

    if (!sender_id || !case_id) {
      console.log("[push] missing sender_id or case_id");
      return new Response(JSON.stringify({ error: "Missing sender_id or case_id" }), {
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
      console.log(`[push] case not found case_id=${case_id} err=${caseErr?.message}`);
      return new Response(JSON.stringify({ error: "Case not found", detail: caseErr?.message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipientIds: string[] = [];
    const petName = (caseData as any).pets?.name || "your pet";

    if (sender_role === "client") {
      if (caseData.assigned_buddy_id) recipientIds.push(caseData.assigned_buddy_id);
    } else {
      const ownerId = (caseData as any).pets?.owner_id;
      if (ownerId) recipientIds.push(ownerId);
    }

    console.log(`[push] recipients=${JSON.stringify(recipientIds)} petName=${petName}`);

    if (recipientIds.length === 0) {
      console.log("[push] no recipients for case");
      return new Response(JSON.stringify({ sent: 0, message: "No recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subscriptions } = await sb
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .in("user_id", recipientIds);

    console.log(`[push] found ${subscriptions?.length || 0} subscription(s) for recipients`);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No push subscriptions for recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!VAPID_PRIVATE_KEY) {
      console.log("[push] VAPID_PRIVATE_KEY not configured");
      return new Response(JSON.stringify({ error: "VAPID_PRIVATE_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const preview = (content || "").slice(0, 100);
    const title = sender_role === "client"
      ? `New message from ${sender_name || "a client"} (${petName})`
      : `${sender_name || "Your Vet Buddy"} sent a message`;
    const pushPayload = {
      title,
      body: preview || "You have a new message",
      url: "/",
      caseId: case_id,
      tag: `msg-${case_id}`,
    };

    let sent = 0;
    const errors: string[] = [];
    for (const sub of subscriptions) {
      try {
        const result = await sendWebPush(sub.endpoint, sub.p256dh, sub.auth, pushPayload);
        if (result.ok) {
          sent++;
          console.log(`[push] delivered status=${result.status} endpoint=${sub.endpoint.slice(0, 60)}...`);
        } else if (result.status === 410 || result.status === 404) {
          await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          errors.push(`Expired subscription removed (${result.status})`);
          console.log(`[push] expired subscription removed status=${result.status}`);
        } else {
          errors.push(`Push failed: status ${result.status} - ${result.body}`);
          console.log(`[push] push service rejected status=${result.status} body=${result.body}`);
        }
      } catch (e) {
        const msg = (e as Error).message;
        errors.push(`Push error: ${msg}`);
        console.log(`[push] exception while sending: ${msg}`);
      }
    }

    console.log(`[push] done sent=${sent} total=${subscriptions.length} errors=${errors.length}`);
    return new Response(JSON.stringify({ sent, total: subscriptions.length, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-push-notification error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
