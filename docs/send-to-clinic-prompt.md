# Send visit prep to the clinic — implementation prompt

Drafted 2026-07-08 from product direction by Dr. Jake Rodgers: the visit-prep
PDF is meant to be **emailed to the vet so it can be linked to their medical
record ahead of the appointment**. Today the owner downloads it and forwards
it themselves. Close that gap with an in-app "Send to clinic" action.

## What exists already

- `generateVetVisitPDF` (app.js ~2912) produces the branded one-pager as a
  Blob, styled per `docs/vet-visit-prep-pdf-prompt.md` (record-matching
  identifiers + owner-reported caveat are already in the document).
- A `send-email` edge function (supabase/functions/send-email) that
  `send-email-on-message` already composes through — the transport exists.
- External providers with emails: the care plan's provider list
  (`care_plan_care_team`, rendered as "External Providers" / `lp.care_team`
  with `email` fields) and `state.careProviders`.
- The calm bridge screen's "share with my vet" currently posts an approval
  message into the Buddy thread (visual-plus, but no delivery) — this
  feature gives it a real destination later.

## Desired flow

1. Next to the existing download in the `download-vet-visit-pdf` success
   path (and as a second button on the dashboard Vet-visit-prep tile), offer
   **"Send to clinic"**.
2. Tapping it shows a small modal: recipient picker listing the pet's
   external providers that have an email on file (plus a free-typed email
   field for clinics not yet listed — typing one offers to save it as a
   provider). One-line preview: "Emails {pet}'s visit prep to {clinic} —
   they'll see it before your appointment."
3. On confirm, a new edge function `send-visit-prep` receives `{ case_id,
   recipient_email, pdf_base64 }`, verifies the caller owns the case (JWT →
   pets.owner_id / accepted co-owner), and composes through `send-email`
   with the PDF attached: subject `Pre-visit summary for {pet} ({owner}) —
   {date}`, a short body identifying Vet Buddies, the owner, and the
   upcoming appointment, reply-to set to the owner's email.
4. Log the send: a `timeline_entries` row (client-visible: "Visit prep sent
   to {clinic}") so both owner and Buddy can see it happened; surface the
   last-sent line under the tile ("Sent to {clinic} · Jul 8").
5. Rate-limit in the edge function (per case, e.g. 5/day) — it emails
   arbitrary addresses on the owner's behalf.

## Constraints

- Attachment must be generated client-side from the SAME generator the
  download uses — one source of truth for the document.
- Never send without an explicit owner tap; no auto-send on schedule.
- `send-email` provider limits: check attachment size support; the PDF is
  ~10 KB, well within any provider cap.
- If `send-email` fails, the owner sees a clear error and the timeline row
  is NOT written.

## Out of scope

- Clinic-side inbox/portal, fax, or PIMS integrations.
- Auto-sending when an appointment is booked (worth revisiting once clinics
  recognize the emails).
- Wiring the calm bridge screen to this path — do it as a follow-up once
  this ships, so calm's "share with my vet" becomes a real send.

## Verification

Local: stub `send-visit-prep` in the harness (route interception), walk
owner → prep tile → Send to clinic → pick provider → confirm; assert the
function receives a well-formed payload with a valid PDF and the timeline
row renders. Then one real end-to-end send to a test inbox before Jake
click-through.
