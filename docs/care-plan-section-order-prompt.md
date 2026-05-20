# Care plan section order rework — implementation prompt

Captured 2026-05-20 from product direction by Dr. Jake Rodgers.

## Goal

Reorder the sections of the client-facing care plan to put **engagement-driving content first** and push static reference material lower. The view in scope is `renderBuddyCase` (the `client-case` view) — that is the default landing for returning clients and the destination of the "Care Plan" nav.

## Why

Right now the section order is optimized for staff workflows: profile completeness, status chips, then pet profile, people, external providers, diagnoses, etc. — *thirteen* sections before the client reaches the **Conversation** card, which is by far the highest-engagement element. Older-owner clients (the target persona) open the app, scroll past a wall of read-only reference cards, and never get to the message thread without scrolling. This rework flips that.

Engagement framework used to choose ordering:
- **Anchor** — establish "this is my pet" emotionally (pet identity header, already in chrome)
- **Stimulus** — show what's new since last visit (messages from Buddy, fresh notes)
- **Action** — surface things the client can DO (respond, add a goal, log a win)
- **Reward** — positive reinforcement (milestones, progress)
- **Reference** — facts/records that might be looked up but rarely the reason for the visit

## Current order (client-visible only, `renderBuddyCase`)

| # | Section | Engagement | File:line |
|---|---|---|---|
| 1 | Profile Completeness progress bar | low (nag) | app.js:5081 |
| 2 | Export/Share toolbar | low (utility) | app.js:5098 |
| 3 | Status strip (LCP status, next appt chip) | low | app.js:5105 |
| 4 | Pet Profile | low (reference) | app.js:5191 |
| 5 | People (owner, buddy, co-owners) | medium (add co-owner) | app.js:5209 |
| 6 | External Providers | low (reference) | app.js:5275 |
| 7 | Diagnoses | low (reference, read-only) | app.js:5344 |
| 8 | Open Questions for Vet | low (read-only to client) | app.js:5381 |
| 9 | Health Record (meds, vitals, vaccines) | low (reference) | app.js:5412 |
| 10 | Appointments | low–medium | app.js:5430 |
| 11 | Active Care Goals | **high** (client can add) | app.js:5438 |
| 12 | **Conversation** | **highest** | app.js:5488 |
| 13 | Engagement (Notes from Buddy + timeline) | medium–high | app.js:5498 |
| 14 | Documents | medium (upload) | app.js:5580 |
| 15 | Milestones & Wins | **high** (client can add) | app.js:5668 |
| 16 | Genetic Insights | low (reference) | app.js:5769 |

Staff-only sections (Owner Wellness, Handoff Notes, DVM Clinical Notes, Internal Notes, Owner Context) stay where they are — clients don't see them, no reordering needed.

## Proposed order

Three bands, each ranked by engagement level:

**Band A — What's new + primary action (above the fold):**
1. **Conversation with Buddy** (was #12)
2. **Engagement / Notes from Buddy** (was #13)
3. **Appointments** (was #10) — time-sensitive next-appointment card belongs here

**Band B — Commit + celebrate:**
4. **Active Care Goals** (was #11)
5. **Milestones & Wins** (was #15)
6. **Documents** (was #14) — "Upload your records" is a high-value action

**Band C — Identity + reference (low priority, scrollable):**
7. **Pet Profile** (was #4)
8. **Health Record — Medications / Vitals / Vaccines** (was #9)
9. **Diagnoses** (was #7)
10. **Open Questions for Vet** (was #8)
11. **People — Care Team + Co-owners** (was #5)
12. **External Providers** (was #6)
13. **Genetic Insights** (was #16) — keep at bottom; only shows when populated anyway

**Closing nudges (de-prioritized to the bottom of the page):**
14. **Profile Completeness progress bar** (was #1) — moved from top to a closing "your plan is N% complete — add more" prompt
15. **Export/Share toolbar** (was #2) — utility, fine at bottom

**Status strip** (was #3): keep visually near the top as part of the page chrome, but slim it down for clients — only the next-appointment chip is interesting to them, the rest is staff signal. (Optional: gate behind `isClient` and hide the staff-only chips entirely for clients. Don't refactor this in the same pass unless quick.)

## Concrete implementation notes

- **All sections already exist as discrete blocks** in `renderBuddyCase` between roughly `app.js:5081` and `app.js:5800`. The work is mostly cut-and-paste — move whole `html += \`<div id="section-X" class="care-plan-section" ...\``  blocks into the new order.
- **Each section has a stable `id="section-{name}"`**. The `_scrollToSection` mechanism in `navigate()` (`app.js:177`) maps tab names to those IDs (e.g. `messages → 'messages'`, `medications → 'health-record'`). After reordering, scroll-to-section still works because we're keeping the IDs — just changing visual position.
- **Conditional visibility logic stays intact.** Sections that hide when empty (e.g. Pet Profile, Diagnoses, Genetic Insights) keep their `if (lp.X || …) { html += … }` guards. After moving they may "disappear" early in the list and the user sees them only when populated — that's fine.
- **Staff-only sections** stay where they currently are. They render via `if (isStaff) { html += … }` blocks — leave those blocks untouched. The reorder applies only to client-facing blocks. If a staff person is viewing a client case, the visual order they see WILL change (their non-staff sections move along with the client's), which is acceptable.
- **Profile-completeness bar** moves — but it's currently at the very top with significant visual weight (progress bar + percentage). Slim it down when relocated: a single-line "🐾 Profile X% complete — [add more]" nudge in a small card.

## What stays the same

- The Page header (back button, breadcrumb, pet name) stays at the top.
- The pet switcher (when there are multiple pets) stays just under the header.
- All `data-action` handlers, `data-field` inputs, render helpers, conditional logic — unchanged.
- `renderClientDashboard` (the legacy simplified view) is NOT in scope for this pass; its order is already more engagement-friendly (Conversation is #4 there). If we mirror later for consistency, that's a follow-up.
- No new sections, no removed sections, no schema changes.

## Files expected to change

- `app.js` only. ~150–200 lines of moves within `renderBuddyCase` (one function). Net line count should be roughly unchanged. Slim the Profile-Completeness card down by ~20 lines.

## Out of scope

- Splitting the status strip into client vs staff chips (mentioned as optional above; defer to a separate pass).
- Adding new engagement features (notifications nudges, daily check-in, etc.).
- `renderClientDashboard` reordering.
- Mobile-specific layout differences — sections should reorder identically on desktop and mobile.

## Verification (local)

After implementing locally and reloading the dev server:

1. Sign in as a client with an existing case (e.g. `jsrodgers92@gmail.com` or `colesrodgers@gmail.com`). You should land on `client-case`.
2. First thing visible below the pet header should be the **Conversation** card — no scrolling required to see it on a 1080p desktop window.
3. Scroll order should match Band A → B → C above. No section should disappear; conditional sections (Diagnoses with no entries, Genetic Insights with none) still hide when empty.
4. Click **💬 Messages** in the nav → still lands on the chat-only view (`client-messages` — out of scope for this rework, just confirming we didn't break it).
5. The "Profile Completeness" progress bar should now appear near the bottom of the page, slimmed to a single-line nudge.
6. Sign in as a **buddy** or **admin** viewing the same case. Confirm staff-only sections (Internal Notes, DVM Notes, Owner Wellness, Handoff Notes) still render where they always did. Confirm the rearranged client-facing sections appear in the new order for staff too.
7. Test the section-scroll deep-links: from any nav button or sidebar item that passes `data-section="messages"` or `data-section="health-record"`, the scroll-to-section animation should still find the right card and scroll to it.

## How to apply

1. Edit `app.js` `renderBuddyCase` only — move the existing `html += \`...\`` blocks into the new order.
2. Slim the Profile-Completeness card on the way down.
3. Commit per [[feedback_vetbuddies_team_local_tree_drift]] (stage only `app.js`).
4. Smoke-test against the running dev server on `localhost:3000`.
5. Confirm with Jake before any Netlify deploy ([[feedback_deploy_caution]]).
