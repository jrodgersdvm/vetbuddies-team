# Onboarding rework — implementation prompt

Captured 2026-05-20 from product direction by Dr. Jake Rodgers.

## Desired UX

**First-time visitor (no account):**
1. Land on **Sign Up** (or be one click away from it).
2. Submit name + email + password → account created → **immediately signed in to the app** (no separate "now log in" step).
3. **Set password modal appears _only if_ the account has no password identity** (i.e. user landed via a magic-link or admin-pre-created row). For ordinary email+password signups, skip it.
4. The very next thing the user sees is the **pet-profile form** ("Tell us about your pet"). No "Start Free Trial" interstitial, no buddy-picker gate, no plan-selection wall.

**Returning user:**
- If the browser has a live Supabase session, restore them silently — **do not flash the login screen** before redirecting. They should land on their care plan / dashboard.
- If the session is gone or expired, show the login form. No "set a password" modal, no pet-profile prompt — they're already onboarded.

## Why

- The current `renderOnboarding` forces a `Start Free Trial` click before the pet form (`app.js` step 1 → step 2). It's friction that adds zero value: the trial is free and we have to start it anyway.
- The pet-profile form already exists (`renderOnboarding` step 2) and is good — we just need to land users on it directly.
- `_showPasswordReset` modal already only triggers when no password identity exists, so the conditional in step 3 is already implemented correctly. Leave it alone.
- `initApp` calls `navigate('login')` unconditionally before `INITIAL_SESSION` fires, causing a login-screen flash for users with a live session.

## Concrete changes

### 1. Auto-start the trial during signup (kill onboarding step 1)

In `app.js` `handleSignUp` (~line 1100), when inserting the new `public.users` row, set:
- `subscription_status: 'trialing'`
- `trial_ends_at: now + TRIAL_DURATION_DAYS`

This matches what `handleInkwellSignup` already does (line 1238-1239) — apply the same to the generic signup path.

Then in `loadProfile` (~line 1447), the existing branch
```js
if ((!data.subscription_status || data.subscription_status === 'none') && state.cases.length === 0)
```
becomes unreachable for new signups and they fall through to the `trialing` branch which sets `state.onboardingStep = 2` and navigates to the pet-profile form directly.

### 2. Drop the `Start Free Trial` step from `renderOnboarding`

Either:
- Remove the `if (step === 1)` block entirely and always render step 2 content; or
- Keep the step-1 block as a fallback for legacy users in `subscription_status === 'none'` but make `renderOnboarding` skip straight to step 2 when `state.onboardingStep >= 2`.

The simplest, lowest-risk move is the second: don't delete code, just don't route new users there. The step indicator at the top of `renderOnboarding` should collapse to a single step ("Add Your Pet") when there's no trial-start needed.

### 3. Suppress the login flash on session restore

In `initApp` (~line 13525), don't call `navigate('login'); render()` right away. Instead:
- Set a transient `state._authBootstrapping = true` flag.
- Render a minimal full-screen "loading" splash (logo + spinner) while we wait for `onAuthStateChange`'s `INITIAL_SESSION` event.
- The `INITIAL_SESSION` handler already does the right thing — restore the user if a session exists, else clear and navigate to login. Just make sure the no-session branch calls `navigate('login')` and clears `_authBootstrapping`.

Cap the wait at ~1.5s with a `setTimeout` fallback so a busted Supabase response doesn't leave the user on a perpetual spinner.

### 4. Leave the `_showPasswordReset` modal alone

It already shows only when `identities[].identity_data.hashed_password` is missing (line 1432-1442 of `app.js`). This satisfies "set a password ONLY if you have not already." No change needed.

## Files expected to change

- `app.js` — `handleSignUp` (trial seed), `renderOnboarding` (collapse to one step), `initApp` (defer login render), one new render helper for the splash, possibly the step-counter in `renderOnboarding`.

That's it. No new files, no schema changes, no migrations.

## Out of scope

- Don't touch `_showPasswordReset` logic.
- Don't touch the Inkwell signup path — it already auto-trials and already routes to step 2.
- Don't touch care-team-invite signup (`renderCareTeamInviteLanding`) — different funnel.
- Don't deploy. Local hosting only until Jake signs off on the click-through.

## Verification (local)

After the change, run `npm run dev` and walk through:

1. Open an incognito window → `http://localhost:3000` → should land on **Sign Up** screen (no login flash).
2. Fill in name/email/password → submit → next screen is the **pet-profile form** (no "Start Free Trial" button anywhere).
3. Save a pet → land in the care-plan view (`client-case`).
4. Refresh the browser → should land back on the care-plan view directly, with **no flash of the login screen**.
5. Sign out → should land on the login form (this is correct behavior for an explicit sign-out).
6. Reopen the app → should show login form (no session) → log in → land on care plan, no onboarding prompts.
