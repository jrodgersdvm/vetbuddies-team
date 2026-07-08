# Classic vs. Calm client layout — comparison prompt

Drafted 2026-07-08. Companion to the other prompts in `docs/`. Hand this to a
review session as-is. The deliverable is an **assessment, not code changes**.

---

## Context

The app now ships two complete pet-owner experiences, both live in
production behind the calm allowlist (`config.js` →
`CALM_CLIENT_ALLOWLIST`):

- **Classic** — the original layout: `renderLayout()` chrome (topbar,
  sidebar, mobile bottom nav) wrapping `renderClientDashboard`, the full
  care-plan view (`renderBuddyCase` reused for view `client-case`),
  `renderClientMessagesOnly`, knowledge base, health timeline, referral
  dashboard. Dense, information-forward, feature-complete.
- **Calm** — the 4-tab experience (`renderCalmClient` and the `renderCalm*`
  family, `app.js` ~3700–4400): Today / Care / Visits / Buddy plus nine
  sub-screens (billing, bridge, wellness + history, messages, profile,
  health snapshot, story, nudges). Quiet, single-focus, deliberately
  de-gamified. Calm clients land here at login and deep links fold into it
  (see the fold block in `render()`); "Switch to classic view" opts out per
  session (`state.calmOptOut`).

Both bind to the same Supabase client, loaders, and RLS. The question this
prompt answers: **what does each layout do better, what is calm missing
before it can become the default for all clients, and what should each
adopt from the other?**

## Method

Work from both the code and the running UI — neither alone is sufficient.

1. **Code pass.** Read the calm section (`app.js` ~3700–4400) and the
   classic client surfaces (`renderClientDashboard` ~4400,
   `renderCarePlanBody` ~6000, `renderMessagesTab`, `renderDocumentsBody`,
   `renderHealthSummary`, and the client branch of `renderLayout`). Build
   the feature inventory from code, not memory — the classic care-plan body
   contains sections calm never mentions.
2. **UI pass.** Use the mock harness in `scripts/calm-ui-harness/` (see its
   README): it stubs Supabase with a two-pet trialing client and drives the
   real app in Chromium. The stub profile is calm-allowlisted; set
   `localStorage.vb_calm = '0'` before load to see classic with identical
   data. Screenshot every screen of both layouts at 390×844 and at a
   desktop width (~1280) — classic has a desktop sidebar; calm is capped at
   480px, so judge what calm on desktop feels like.
3. **Task walkthroughs.** Score both layouts on the same owner tasks, in
   taps/clicks from login: check today's meds · message the Buddy · see the
   next visit and add a question for it · find a document the practice
   uploaded · check weight history · update billing · add a second pet ·
   handle the trial-expired read-only state. Note dead ends, not just tap
   counts.

## Dimensions to judge

For each: which layout wins, why, and what the loser should take from it.

- **Information access vs. focus.** Classic shows everything; calm shows
  one thing. Where does calm's curation become concealment (e.g. documents,
  timeline, vitals charts, co-owners, genetic insights have no calm
  surface)? Where does classic's density become noise?
- **Navigation model.** Classic: router views + tabs + scroll-to-section.
  Calm: 4 tabs + sub-screen stack. Compare depth to reach each task above,
  and back-button/refresh behavior in both.
- **Emotional register.** Calm is written for a worried owner (SHARE /
  SUPPORT / BRIDGE, no streaks, memorial mode). Is classic's tone actively
  costing anything, or is calm's tone the only real difference?
- **Feature parity.** Produce the matrix: every classic client capability →
  calm equivalent / intentional omission (argue why) / gap that blocks
  making calm the default. Flag anything reachable in calm only by falling
  back to classic views (add-pet form, profile settings, plan picker).
- **States and edges.** No pets · multi-pet · trial expired (soft read-only
  in calm vs. paused banner + paywall in classic) · past_due hard paywall ·
  unread messages / notification affordances · dark mode (classic supports
  it; calm is pinned light by design — problem or feature?).
- **Mechanics.** Initial-load work (classic preloads the full case; calm
  lazy-loads), perceived speed on first paint, PWA/small-screen ergonomics,
  a11y basics (focus order, tap targets, aria on the two nav patterns).

## Deliverable

`docs/layout-comparison.md` containing: a one-paragraph verdict up top;
strengths/weaknesses for each layout (prose, grounded in specific screens —
cite function names); the parity matrix; the task-walkthrough scores; and a
short ranked list of recommendations split three ways — *calm should adopt*,
*classic should adopt*, *blockers before calm becomes the default*. Attach
the screenshots (or commit them under `docs/img/` if small). No code
changes; open questions for Jake go in a final section.

## Out of scope

- Staff (buddy/admin/external) layouts — client experiences only.
- Implementing any recommendation — that's a follow-up prompt.
- Rollout decisions (allowlist, `CALM_CLIENT_ENABLED`) — surface evidence,
  Jake decides.
