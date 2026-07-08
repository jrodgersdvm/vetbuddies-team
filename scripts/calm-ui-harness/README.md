# Calm UI harness

Drives the real app in headless Chromium against a mocked Supabase client,
so client UI flows can be exercised and screenshotted without credentials,
network access, or touching production data.

- `supabase-stub.js` — mock of the `@supabase/supabase-js` UMD build.
  Served in place of the CDN script via Playwright request interception.
  Fakes a **client** account (`jrodgersdvm@gmail.com`,
  trialing) with two pets: Percy (corgi, one active medication, a visit
  ~10 days out) and Willow (cat, empty care plan). All other tables read
  as empty; inserts echo back with generated ids.
- `calm-e2e.js` — regression suite for the calm client experience
  (33 checks): login lands on calm home, pet switcher, meal-log
  persistence, bridge share, deep-link fold via a simulated
  push-notification click, reload behavior.

## Run

```sh
node server.js                      # serve the app on :3000
npm install playwright-core --no-save
node scripts/calm-ui-harness/calm-e2e.js
```

Chromium: the script uses `executablePath: '/opt/pw-browsers/chromium'`
(the path in Claude's remote environment). On a normal machine, install
Playwright's browsers and drop the `executablePath` override, or point it
at any local Chromium/Chrome binary.

## Choosing a layout

Classic is the default for everyone; calm is available to every client
account (GA). The stub account boots classic unless the persisted
preference says otherwise:

```js
await page.addInitScript(() => localStorage.setItem('vb_layout', 'calm'));
```

(`vb_layout` ∈ 'classic' | 'calm' is the user's saved choice, set by the
"Try Calm mode" / "Switch to classic view" doors. The `vb_calm` testing
override still exists: '1' forces calm regardless of choice or allowlist,
'0' forces classic.)

## Notes

- The mock's appointment timestamp is day-aligned so reloads see the same
  visit — the bridge-share confirmation is pinned to the visit's
  `scheduled_at` and would otherwise reset on every run.
- The stub answers every un-modeled table with empty rows, which is how
  RLS-empty states look in production; add rows to the stub's constants to
  model richer accounts.
