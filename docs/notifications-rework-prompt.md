# Notifications rework — implementation prompt

Captured 2026-05-20 from product direction by Dr. Jake Rodgers.

## Desired behavior

**Every message a user receives produces two side effects, by default:**

1. **An email** to the recipient's address telling them they have a new message on the app, with a deep link back to the case.
2. **A push notification** to every device they have the installed PWA on (Android/iOS/desktop), assuming they granted browser permission.

This is the **default for all current and future users.** Users can opt out in settings, but they don't have to opt in.

**Concrete test:** Jake sends a re-engagement message to Cole (owner of Scemi). Cole should receive:
- An email at his address: subject like "New message from Vet Buddies", body with a preview + "Open in app" link.
- If Cole has the installed PWA: a push notification on his device that wakes the app to the case when tapped.

If Cole has not granted browser permission, he still gets the email. If he has not installed the PWA, he still gets the email.

## Why

Per the [notifications audit](#audit-summary) below, the wiring is **half-built**:
- Push fan-out works (`send-push-notification` edge function v11 is live, `push_subscriptions` table is populated, `sw.js` handles `push` and `notificationclick`).
- Email fan-out **does not fire on new messages** — `send-email` edge function exists (v8, Resend-backed) but `sendMessage` in `app.js:13130-13165` only calls `send-push-notification`, never `send-email`.
- New users get `push_enabled: false` by default. They have to find Settings → Notifications and toggle it on, then grant browser permission. That's why nobody is getting push notifications.
- The "Re-Engagement Alerts" dashboard (`app.js:7003`) lists at-risk clients but has no Send-Message button — the only action is "View Case", which dumps the admin into the case view to type a message manually.

## Concrete changes

### 1. Flip notification defaults to ON (new + existing users)

**Migration** (`supabase/migrations/202605XX_notifications_default_on.sql`):

```sql
-- New users: change column defaults
ALTER TABLE notification_preferences
  ALTER COLUMN push_enabled SET DEFAULT true,
  ALTER COLUMN email_messages SET DEFAULT true,
  ALTER COLUMN email_escalations SET DEFAULT true;

-- Existing users who have a row but never explicitly toggled anything (i.e.,
-- their current values match the OLD defaults of push=false). Flip them on.
-- Anyone who actively opted out — i.e. push_enabled=false alongside
-- email_messages=false — stays opted out so we don't override an explicit choice.
UPDATE notification_preferences
  SET push_enabled = true
  WHERE push_enabled = false
    AND email_messages = true;

-- Existing users with NO notification_preferences row at all: insert default row
-- so the fan-out edge functions find them.
INSERT INTO notification_preferences (user_id, push_enabled, email_messages, email_escalations)
SELECT u.id, true, true, true
FROM public.users u
LEFT JOIN notification_preferences np ON np.user_id = u.id
WHERE np.user_id IS NULL
  AND u.role IN ('client', 'vet_buddy', 'admin', 'practice_manager');
```

Apply via Supabase MCP (`apply_migration`). After applying, sanity-check with a SELECT to confirm Cole's row has `push_enabled=true`.

### 2. Auto-prompt browser permission post-login

In `loadProfile` (`app.js:1408`), after the profile loads and `subscribeToPush()` is gated on `Notification.permission === 'granted'` (`app.js:1424`), add a one-time prompt:

```js
// If the user has push_enabled in their prefs but hasn't granted browser
// permission yet, ask once per session. Don't badger them — if they say no
// or dismiss, respect it for the rest of the session.
if (state.notificationSettings?.push_enabled
    && 'Notification' in window
    && Notification.permission === 'default'
    && !sessionStorage.getItem('vb_push_prompted')) {
  sessionStorage.setItem('vb_push_prompted', '1');
  // Defer so the prompt doesn't clobber the post-login render
  setTimeout(() => {
    Notification.requestPermission().then(p => {
      if (p === 'granted') subscribeToPush();
    });
  }, 1500);
}
```

This must NOT fire on the login screen — only after `loadProfile` succeeds and we know the user. Don't auto-prompt inside an iframe or in dev tools where it'd fail silently.

### 3. Wire email into every message send

In `app.js` ~line 13158, alongside the existing `send-push-notification` call, add a parallel `send-email` call. Make them independent fire-and-forgets so one failure doesn't kill the other:

```js
// Trigger push notification (best-effort, don't block)
callEdgeFunction('send-push-notification', {
  sender_id: state.profile.id,
  sender_role: state.profile.role,
  case_id: state.caseId,
  content: content || '',
  sender_name: state.profile.name,
}).catch(e => console.warn('Push notification failed:', e));

// Trigger email notification (best-effort, don't block)
callEdgeFunction('send-email-on-message', {
  case_id: state.caseId,
  sender_id: state.profile.id,
  sender_role: state.profile.role,
  sender_name: state.profile.name,
  content_preview: (content || '').slice(0, 280),
  message_id: newMsg.id,
}).catch(e => console.warn('Email notification failed:', e));
```

The new edge function `send-email-on-message`:
- Queries `cases` + `users` + `notification_preferences` to determine the recipient(s) (mirror the logic in `send-push-notification/index.ts`).
- Filters out recipients with `email_messages=false`.
- Filters out the sender themselves (don't email me my own message).
- Calls the existing `send-email` function with a templated body. Subject: `"New message about {pet_name} on Vet Buddies"`. Body has the sender name, a 280-char preview, and a CTA link `https://vetbuddies-team.netlify.app/?case={case_id}` (the app will route to the case after auth).
- Returns `{ sent, total, errors }` matching the push function's shape.

**Why a new wrapper instead of calling `send-email` directly from the client:** the client doesn't have authority to look up other users' emails (RLS), and we want recipient-resolution logic in one place. The wrapper runs with the service role.

**Implementation note:** Use `mcp__claude_ai_Supabase__deploy_edge_function` per [[reference_vetbuddies_edge_function_deploy]]. Pull the existing `send-email` source via `get_edge_function` first so the new wrapper can reuse its API contract (likely `{ to, subject, html, text, tags }`).

### 4. Re-engagement send action

In `renderReEngagementAlerts` (`app.js:7003`), replace the existing "View Case" button with two buttons:

```html
<button class="btn btn-primary btn-small" data-action="open-reengagement-modal" data-case-id="{c.id}">📢 Send Message</button>
<button class="btn btn-secondary btn-small" data-action="nav-buddy-case" data-case-id="{c.id}">View Case</button>
```

`open-reengagement-modal` opens a small overlay with:
- A textarea pre-populated with a templated nudge (e.g. "Hi {owner_first_name}, just checking in on {pet_name}. How are things going?").
- A Send button that:
  1. Inserts a `messages` row addressed to that case with `sender_role: 'admin'`, sender_id = current admin, content = textarea value.
  2. Fires the same push + email fan-out as a normal message (steps 3 above already cover this — re-engagement messages traverse the same path).
  3. Logs an audit entry with action `re_engagement_message_sent`, case_id, recipient_user_id.
  4. Closes the modal and shows a toast `"Re-engagement message sent to {owner_name} — they'll get a push notification and email."`

Don't make re-engagement a special-cased flow with its own edge function. It's just a normal message with an admin convenience UI on top.

### 5. Tighten the push edge function

`send-push-notification` (v11) needs a small audit before this ships:
- Confirm it filters recipients by `notification_preferences.push_enabled = true`. If not, add that filter so users who explicitly opted out aren't re-targeted by the new defaults.
- Confirm it respects `notification_preferences.muted_case_ids` array — if `case_id` is in the recipient's muted list, skip.
- Confirm it respects `quiet_hours_start`/`quiet_hours_end` (suppress, queue, or fall back to email-only — pick one, document it). The existing `utils.js:243-258` quiet-hours helper is client-side only; the edge function probably ignores it. Either move quiet-hours enforcement server-side, or accept push happens regardless and quiet hours only suppress local sound on existing devices.

Don't change the encryption / VAPID logic — just the filters.

## Files expected to change

- `supabase/migrations/202605XX_notifications_default_on.sql` — new
- `supabase/functions/send-email-on-message/index.ts` — new (deploy via MCP)
- `supabase/functions/send-push-notification/index.ts` — edits to add `push_enabled` + `muted_case_ids` filters (pull current source via MCP first; don't hand-type per [[feedback_edge_function_deploy_hand_typing]])
- `app.js` — `loadProfile` (permission auto-prompt), `sendMessage` block at line ~13158 (add email call), `renderReEngagementAlerts` (add Send button), new modal + action handler for the re-engagement message form.

## Out of scope

- SMS (referenced in state but no edge function exists — separate project).
- Per-event notification toggles (e.g. "email me about messages but not appointments") — keep it simple, two switches: `email_messages` and `push_enabled`.
- Push notification *content* beyond message preview (no AI summary, no rich actions). Tap → open the case.
- iOS Safari quirks (web push works on iOS 16.4+ when installed as PWA — confirm in QA but don't engineer around).
- Re-engagement automation (auto-send after N days) — manual admin trigger only for now.
- Marketing emails (digest, weekly summary) — `weekly_digest` column already exists, leave at default `false`.

## Verification (local + production)

After implementing locally and hosting on port 3000:

1. **Defaults check (DB):** Run `SELECT user_id, push_enabled, email_messages FROM notification_preferences WHERE user_id IN (SELECT id FROM users WHERE email = '<cole's email>')`. Expect `push_enabled=true, email_messages=true`.
2. **Auto-prompt:** Sign in as a brand-new test client in an incognito Chrome window. Within ~1.5s of landing on the dashboard, the browser permission prompt fires.
3. **Push delivery:** Grant permission. Confirm a row appears in `push_subscriptions` for that user. From another browser, sign in as admin and send them a message. The test client's device should buzz within a few seconds.
4. **Email delivery (the Cole test):** From admin, navigate to Re-Engagement Alerts → find Cole → click "Send Message" → type a short note → Send. Confirm:
   - Toast appears confirming send.
   - Email arrives at Cole's address (check Resend logs if it doesn't — `RESEND_API_KEY` may have rotated).
   - If Cole's installed PWA has push permission granted: push fires on his device.
   - Tapping the push or the email's "Open in app" link routes him into the case after login.
5. **Opt-out respect:** Toggle `push_enabled` off in settings for a test user. Send them a message. Confirm push does NOT fire but email still does. Toggle `email_messages` off; confirm neither fires.
6. **No self-notify:** Send a message as Cole. Confirm Cole does NOT receive an email or push to himself.

## Audit summary

Recorded 2026-05-20 against `vetbuddies-team` HEAD `c53a41e`:

| Layer | Where | Status |
|---|---|---|
| Service Worker push handler | `sw.js:70-103` | Working — parses JSON payload, shows notification, opens case on click. |
| Push edge function | `supabase/functions/send-push-notification/index.ts` (v11, live) | Working but doesn't filter on `push_enabled` or `muted_case_ids` — needs audit. |
| `push_subscriptions` table | Migration `20260411124326` | Working — endpoint, p256dh, auth keys per device, RLS in place. |
| Email edge function | `send-email` (v8, live on Supabase, NOT in local repo) | Working — Resend-backed, called only from Inkwell welcome. |
| Notification preferences | `notification_preferences` table (`20260411003258`) | Defaults wrong: `push_enabled=false`, `email_messages=true`, `email_escalations=true`. |
| Message → notify path | `app.js:13130-13165` | Push fires, **email does not** — this is the main gap. |
| Re-engagement UI | `app.js:7003 renderReEngagementAlerts` | Dashboard only, no send action. |
| PWA install detection | `manifest.json` + `app.js:9629` standalone check + `beforeinstallprompt` capture | Working — `state.pwaInstallPrompt` available. |

## How to apply

1. Implement the migration; apply via `mcp__claude_ai_Supabase__apply_migration`.
2. Deploy `send-email-on-message` and updated `send-push-notification` via `mcp__claude_ai_Supabase__deploy_edge_function`. Write the TS source to disk first ([[feedback_edge_function_deploy_hand_typing]]).
3. Edit `app.js` in three places (loadProfile, sendMessage, renderReEngagementAlerts + new modal).
4. Commit per [[feedback_vetbuddies_team_local_tree_drift]] (only the files touched).
5. Host locally with `npm run dev`; walk the verification steps.
6. Confirm with Jake before Netlify deploy. Don't blind-deploy ([[feedback_deploy_caution]]).
