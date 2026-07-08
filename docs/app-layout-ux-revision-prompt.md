# App layout & UI/UX revision — implementation prompt

Drafted 2026-07-08. Companion to the other rework prompts in `docs/`. Hand this
to an implementation session as-is.

---

## Context (read first)

Vet Buddies is a no-framework, single-page PWA. Everything renders as HTML
template strings out of one file:

- `app.js` (~15,300 lines) — all views, all roles, all event handling. The
  app shell lives in `renderLayout(content)` (~line 8889): sticky dark-green
  topbar, desktop sidebar nav, mobile bottom nav (per-role, max 5 items),
  notifications panel, dark-mode toggle.
- `styles.css` (~5,500 lines) — global stylesheet with `:root` design tokens
  at the top.
- `index.html` — static shell; fonts are Fraunces (display) + DM Sans (body).
- Roles: `client`, `vet_buddy`, `admin` / `practice_manager`, `external_vet`.
  Route dispatch is the big `switch (state.view)` inside `render()`
  (~line 10348).
- There are **two client experiences**: the classic dashboard
  (`renderClientDashboard`, wrapped in `renderLayout`) and the feature-flagged
  "Calm Client" 4-tab UI (`renderCalmClient` / `renderCalmShell`, ~line 3816),
  which has its own shell, its own tab bar, and its own visual language.

## The problem

The app grew view-by-view and it shows. Specific, observable issues:

1. **Two competing shells.** Calm Client and the classic layout share no
   chrome. A client who toggles between them (via `state.calmOptOut`) gets a
   different header, different nav metaphor, and different spacing rhythm.
   Staff roles live in a third visual world (denser, sidebar-driven).
2. **Design tokens are aliases in name only.** In `:root`,
   `--blue`, `--green`, `--sage`, `--primary`, and `--client-accent` are all
   `#689562`; `--red`, `--purple`, and `--burgundy` are all `#4F152F`. Semantic
   intent (info vs success vs danger) has been flattened away, so status
   colors can't be distinguished and dark mode overrides are guesswork.
3. **Inline styles everywhere.** Large chunks of chrome are styled inline in
   JS template strings — topbar buttons, the paused-subscription banner, the
   sidebar footer, the skip link in `index.html` (which styles itself via
   `onfocus`/`onblur` handlers). This defeats the stylesheet, dark mode, and
   any consistency effort.
4. **Emoji as iconography.** Nav, buttons, and badges use raw emoji (📋 💬 📚
   ⭐ 📬). Rendering varies wildly by platform and reads as unfinished next to
   the otherwise warm, editorial brand (Fraunces + cream/forest palette).
5. **No spacing or type scale.** Padding, radii, font sizes, and shadows are
   ad-hoc per view (`12px 16px`, `10px`, `13px`, one-off gradients). Nothing
   enforces rhythm.
6. **Mobile nav inconsistencies.** The bottom nav's active-state check is
   `state.view.includes(...)` string matching (~line 9012), which mis-lights
   tabs for adjacent views. The client bottom nav has 5 items with long labels
   ("Knowledge Base", "Share Vet Buddies") that wrap or truncate on small
   phones.

## Goal

One coherent design system across all roles, with the **Calm Client visual
language as the reference point** — it's the newest, calmest, most
on-brand surface. Staff views keep their density but adopt the same tokens,
type scale, and chrome components. This is a **restyle and shell
consolidation, not a rewrite**: no framework, no build step, no changes to
routing, state, data flow, or Supabase calls.

## Concrete changes

### Phase 1 — Design tokens (`styles.css` `:root`)

Rebuild the token block as a real system, keeping the existing brand hues:

- **Semantic colors:** `--color-success`, `--color-warning`, `--color-danger`,
  `--color-info` must be *visually distinct* (today success/info are identical
  and danger/warning are muddy). Keep forest `#336026`, sage `#689562`, cream
  `#EDE8E0` as the brand core; pick warning/danger/info values that harmonize
  (warm amber, deep brick, muted slate-teal — designer's choice, but distinct
  and WCAG AA on their backgrounds).
- **Spacing scale:** `--space-1` … `--space-8` (4px base).
- **Type scale:** `--text-xs` … `--text-2xl` plus `--font-display: 'Fraunces'`
  and `--font-body: 'DM Sans'`.
- **Radii & elevation:** `--radius-sm/md/lg/full`, `--shadow-1/2/3`.
- Keep the old variable names as aliases pointing at the new tokens for one
  release (`--blue: var(--color-info);` etc.) so untouched views don't break;
  grep-audit and delete the aliases at the end.
- Mirror every new token in the dark-mode block so `renderDarkModeToggle()`
  keeps working.

### Phase 2 — One shell (`renderLayout` + `renderCalmShell`)

- Extract the shared chrome into small helpers: `renderTopbar()`,
  `renderSideNav(items)`, `renderBottomNav(items)` — pure functions returning
  HTML strings, same pattern as the rest of `app.js`.
- `renderLayout` (staff + classic client) and `renderCalmShell` both compose
  from these helpers so header height, logo treatment, notification bell,
  avatar, and sign-out live in exactly one place.
- Fix bottom-nav active state: match on an explicit list of view names per
  item, not `String.includes`.
- Client bottom nav: cut to 4 items max with short labels (e.g. "Care Plan",
  "Messages", "Library", "Timeline"); move "Share Vet Buddies" into the
  profile/settings surface.
- Replace emoji icons with a small inline-SVG icon set (one `icon(name)`
  helper returning `<svg>` strings, `currentColor` fill, ~16–20 icons total).
  No icon font, no external requests (CSP).

### Phase 3 — Kill the inline styles (mechanical, big win)

- Move every inline `style="…"` on shell chrome (topbar buttons, badges,
  paused banner, sidebar footer, notification dot) into classes in
  `styles.css` using the new tokens.
- Replace the `index.html` skip link's `onfocus`/`onblur` inline-style hack
  with a `.skip-link` / `.skip-link:focus` rule pair.
- View bodies can be migrated opportunistically — chrome first, views as
  touched. Do **not** attempt a single-pass sweep of all 15k lines.

### Phase 4 — Layout rhythm per surface

- **Client (classic + calm):** single-column, max-width ~720px, generous
  whitespace, cards on `--card-bg` with `--radius-lg`/`--shadow-1`. Section
  headers in Fraunces. The calm tabs and the classic dashboard should be
  visually indistinguishable in tone even though their information
  architecture differs.
- **Staff (buddy/admin/external):** keep density, but normalize: consistent
  page-header pattern (title + primary action, right-aligned), tables/cards on
  the shared spacing scale, sidebar uses the same nav component as everything
  else. The case-view sidebar collapse behavior (`vb_case_sidebar_collapsed`)
  stays as-is.
- **Forms & modals:** one input style (height, radius, focus ring using
  `--color-info` at 40% alpha), one modal style. Buttons: primary (forest),
  secondary (outline), destructive (danger token) — audit existing `data-action`
  buttons into these three.

### Phase 5 — Accessibility & mobile polish

- 44px minimum tap targets are already attempted piecemeal (inline
  `min-height:44px` on the bell) — make it a class-level guarantee on all
  interactive chrome.
- Visible focus states on every interactive element (`:focus-visible`
  outline, token-driven).
- Verify contrast: body text `#336026` on `#EDE8E0` passes, but audit
  `--text-secondary` (`#5A4F3F`) on `--beige` surfaces and every badge/banner
  combo; fix with token adjustments, not per-spot overrides.
- Respect `prefers-reduced-motion` for the button `scale(0.98)` press effect
  and any transitions you add.

## Files expected to change

- `styles.css` — token rebuild, new chrome classes, dark-mode mirror. Expect
  significant churn here; it's the point.
- `app.js` — `renderLayout`, `renderCalmShell`, new `renderTopbar` /
  `renderSideNav` / `renderBottomNav` / `icon()` helpers, bottom-nav config,
  inline-style removal on chrome. **No changes** to `state`, `navigate()`,
  data loading, or the `render()` switch beyond what shell composition needs.
- `index.html` — skip-link cleanup only.

No new files (helpers live in `app.js` per house style), no schema changes,
no migrations, no new dependencies, no build step.

## Out of scope

- No framework, bundler, or CSS preprocessor.
- No changes to onboarding, notifications, or care-plan section order — those
  have their own prompts in `docs/`.
- No copy rewrites beyond nav labels named above.
- Don't remove the classic-client experience or the `state.calmOptOut`
  escape hatch — restyle both, delete neither.
- Don't touch `sw.js`, CSP headers, or the SW cache-bust script in
  `index.html`.
- Don't deploy. Local only until Jake signs off on a click-through.

## Verification (local)

Run `npm run dev` and click through at each phase boundary — don't stack all
five phases unverified:

1. **Client:** log in as a client → classic dashboard, care plan, messages,
   knowledge base, health timeline. Then the calm UI (allowlisted account) →
   all 4 tabs. Chrome should be identical between the two.
2. **Staff:** vet_buddy → dashboard, inbox, case view (sidebar collapse still
   works, preference persists). Admin → dashboard, cases, inbox, team,
   escalations, schedule.
3. **Mobile:** DevTools at 375×667 — bottom nav shows correct active tab on
   every view, no label wrap, no horizontal scroll anywhere, tap targets
   ≥44px.
4. **Dark mode:** toggle it on every surface above; no unstyled white flashes,
   badges and banners readable.
5. **A11y quick pass:** keyboard-tab through the shell (skip link appears on
   focus, focus rings visible), Lighthouse accessibility score doesn't
   regress.
6. `npm test` still passes (utils are untouched, so this is a smoke check).
