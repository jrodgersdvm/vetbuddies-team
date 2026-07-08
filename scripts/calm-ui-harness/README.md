# Calm UI harness

Drives the real app in headless Chromium against a mocked Supabase client,
so client UI flows can be exercised and screenshotted without credentials,
network access, or touching production data.

- `supabase-stub.js` — mock of the `@supabase/supabase-js` UMD build.
  Served in place of the CDN script via Playwright request interception.
  Fakes a calm-allowlisted **client** account (`jrodgersdvm@gmail.com`,
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

## Viewing the classic layout with the same data

The stub account is calm-allowlisted, so the app boots into the calm UI.
To compare against the classic layout with identical data, force the
per-browser override before the page loads:

```js
await page.addInitScript(() => localStorage.setItem('vb_calm', '0'));
```

(`vb_calm` is read by `isCalmClientEnabled` — '0' forces classic,
'1' forces calm, unset falls back to the config allowlist.)

## Notes

- The mock's appointment timestamp is day-aligned so reloads see the same
  visit — the bridge-share confirmation is pinned to the visit's
  `scheduled_at` and would otherwise reset on every run.
- The stub answers every un-modeled table with empty rows, which is how
  RLS-empty states look in production; add rows to the stub's constants to
  model richer accounts.
