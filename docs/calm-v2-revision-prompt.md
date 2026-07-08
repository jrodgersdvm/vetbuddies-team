# Calm layout v2 — implementation prompt

Drafted 2026-07-08 from product direction by Dr. Jake Rodgers: **he prefers
the original (classic) layout.** Calm is not being removed, but it must stop
trading away classic's strengths to get its tone. This prompt revises calm so
an owner who chooses it gives up nothing that matters, and restores classic
as the default.

Read `docs/layout-comparison.md` first — every change below traces to a
finding there. Screenshots in `docs/img/`, harness in
`scripts/calm-ui-harness/`.

## What classic does better (the bar calm must meet)

1. **Nothing is hidden.** Documents, weight chart, vaccines, diagnoses,
   providers, settings, add-pet — all reachable. Calm currently conceals or
   dead-ends on several (documents and add-pet dead-end outright).
2. **Messaging is zero-friction.** The conversation sits at the top of the
   landing view with a full composer (attachments + voice). Calm buries it
   two taps deep behind a text-only composer.
3. **Trust through explicitness.** The recipient banner ("This message goes
   to: Maya Chen + Dr. Rodgers") tells the owner exactly who reads what.
4. **Desktop is a real layout**, not a centered phone column.

Calm's genuine wins — the Today focus, visit prep, soft trial handling, the
bridge approval, memorial mode, its tone — stay. This is addition, not
retreat.

## Concrete changes

### 1. Classic is the default; calm becomes a persistent choice

- Replace the session-only `state.calmOptOut` with a persisted preference:
  `localStorage 'vb_layout'` ∈ `'classic' | 'calm'`, **default `'classic'`**
  — for allowlisted accounts too. The allowlist now controls who *may* use
  calm, not who is forced into it.
- `loadProfile` (the calm branch added at ~app.js:1635) and the deep-link
  fold in `render()` honor the preference instead of `isCalmClientEnabled`
  alone: route to calm only when preference is `'calm'`.
- Calm's "Switch to classic view" sets the preference (no more reverting on
  refresh). Classic gets the reverse door: a quiet "Try Calm mode" entry for
  allowlisted accounts (sidebar footer + dashboard, not a banner).
- Keep the `vb_calm` localStorage testing override behavior intact.

### 2. Kill the dead ends (comparison report "blockers" 1–3)

- **Add pet:** a "+" chip at the end of the calm pet-switcher row
  (`renderCalmToday`), and an "Add another pet" row on the profile
  sub-screen. Both → existing `nav-add-pet`.
- **Documents:** new calm sub-screen `docs` reachable from a "Files &
  records" row on the Care tab: list from `state` via `loadDocuments`
  (calm-styled rows: name, type badge, date; tap → existing signed-URL
  open). Include the upload control (reuse the `trigger-doc-upload`
  machinery) gated by `hasWriteAccess`. Calm-voiced empty state.
- **Settings:** a gear on the calm profile sub-screen (or Today header) →
  existing `nav-profile` (classic profile-settings view is fine to reuse
  as-is; it's a utility screen, not an experience).

### 3. Messaging reaches classic parity

- **Composer:** add attach-photo and voice-note buttons to the calm
  composer (`renderCalmSub` case `'message'`). Reuse the exact
  `send-message` handler path — it already reads `[data-field=
  "message-input"]` and `window._pendingAttachment`; calm only needs the
  buttons and a pending-attachment chip in its own styling.
  `renderCalmBubble` already displays attachments/voice.
- **Recipient banner:** one calm-styled line above the thread: "Goes to
  {buddy first name} + Dr. Rodgers" — same facts as classic's banner.
- **Faster entry:** on Today, when there are unread Buddy messages, the
  focus card yields to (or is followed by) a "{Buddy} wrote to you" card
  that opens the message sub in one tap. Zero-friction reply is classic's
  single biggest strength — calm gets within one tap of it.

### 4. Care tab carries the full record (curated, not concealed)

Keep the current calm sections, then add beneath them, in calm styling:

- **Weight:** an inline sparkline/mini-chart of `state.petVitals` weight
  history on the health-snapshot sub-screen (SVG polyline is enough — do
  NOT load Chart.js into calm), plus the values list.
- **Vaccines:** full list with due dates on a sub-screen (calm currently
  shows one row); client add stays classic-only for now.
- **Diagnoses & providers** already exist on the profile sub — link them
  from the Care tab so they're discoverable, not just from the pet header.
- **"View full records":** an explicit link at the bottom of the Care tab
  that opens the classic care-plan view (`nav-client-case`) WITHOUT
  changing the saved layout preference — one-off borrow, land back in calm
  on next login. This is the escape valve that makes curation honest.

### 5. Honest signals

- Bell + nudges: back the `notifs` sub-screen with the same message-inbox
  data the classic notifications panel uses (top unread, urgent first),
  not just synthesized items; bell dot logic stays keyed to real unread.
- Fix the hardcoded "2nd-year vet student" in `renderCalmBuddy` — derive
  from the buddy's row (`bio`/role fields), fall back to "Your Vet Buddy".

### 6. Desktop stops being a phone column

At ≥900px, `.calm-app` widens to a ~760px content column with the tab bar
docked left as a slim vertical rail (icons + labels), mirroring classic's
sidebar ergonomics. Cards keep their width discipline (~560px max text
measure); this is layout, not new screens. Below 900px nothing changes.

## Files expected to change

- `app.js` — routing/preference (~1635, the render() fold, calm-classic
  handler), `renderCalmToday` (+ chip, unread card), `renderCalmSub`
  (message composer, new `docs` sub, health snapshot chart, notifs data),
  `renderCalmCare` (records links, full-records link), `renderCalmBuddy`
  (role line), classic sidebar footer ("Try Calm mode").
- `styles.css` — calm section: composer buttons, docs rows, sparkline,
  desktop rail media query, "+" chip.
- `scripts/calm-ui-harness/` — extend stub (documents, vitals series,
  unread message) and add checks: classic-by-default landing, persistent
  toggle both ways, add-pet chip, docs sub-screen, attachment button
  present, full-records link doesn't flip the preference.

No schema changes. No new dependencies (no Chart.js in calm).

## Out of scope

- Removing or restyling classic (separate prompt covers its cleanups:
  `undefined` chip, dead XP layer, section-nav gating).
- Knowledge base and community/care-requests entry points in calm — open
  questions for Jake, not this pass.
- The provider-facing bridge push; `CALM_CLIENT_ENABLED` semantics.

## Verification (local)

`node server.js` + the harness. Must pass: existing 33 checks (update the
login-landing check: stub with no saved preference now lands CLASSIC), plus
new checks above. Then the click-through: fresh profile lands classic → "Try
Calm mode" → calm persists across reload → add a pet from calm → open a
document → send a message with an attachment → "View full records" borrows
classic once without changing the preference → switch back to classic
persistently. Screenshot calm desktop at 1280 for Jake before sign-off.
