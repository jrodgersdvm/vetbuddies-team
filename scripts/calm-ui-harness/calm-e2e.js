const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const STUB = fs.readFileSync(path.join(__dirname, 'supabase-stub.js'), 'utf8');
let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log('  ✓ ' + name);
  else { failures++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); }
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });

  // Serve the stub in place of the CDN supabase UMD; block other externals quietly.
  await page.route('**cdn.jsdelivr.net/**supabase**', r => r.fulfill({ contentType: 'application/javascript', body: STUB }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.calm-app', { timeout: 8000 }).catch(() => {});

  console.log('— Login lands on calm home —');
  check('calm shell rendered after session restore', await page.locator('.calm-app').count() === 1);
  check('Today tab active', (await page.locator('.calm-nav-item.active .calm-nav-label').textContent().catch(() => '')) === 'Today');

  console.log('— Multi-pet switcher —');
  check('two pet chips', await page.locator('.calm-pet-chip').count() === 2);
  check('Percy chip active', (await page.locator('.calm-pet-chip.active').textContent() || '').includes('Percy'));
  check('greeting mentions Percy', (await page.locator('.calm-greet-sub').textContent() || '').includes('Percy'));

  console.log('— Meal log (Percy has meds → strip focus) —');
  check('7-segment strip shown', await page.locator('.calm-seg').count() === 7);
  check('strip starts empty (honest)', await page.locator('.calm-seg.on').count() === 0);
  check('bell dot hidden with nothing unread', await page.locator('.calm-bell-dot').count() === 0);
  await page.locator('[data-action="calm-toggle-meal"]').click();
  await page.waitForTimeout(150);
  check('today segment lights after logging', await page.locator('.calm-seg.on').count() === 1);
  check('confirm chip shown', (await page.locator('.calm-chip-confirm').textContent().catch(() => '')).includes('Logged for today'));
  const stored = await page.evaluate(() => localStorage.getItem('vb_calm_meals_p1'));
  check('persisted to localStorage per pet', !!stored && JSON.parse(stored).length === 1, stored);

  console.log('— Switch to Willow —');
  await page.locator('.calm-pet-chip', { hasText: 'Willow' }).click();
  await page.waitForTimeout(400);
  check('Willow chip active', (await page.locator('.calm-pet-chip.active').textContent() || '').includes('Willow'));
  check('greeting mentions Willow', (await page.locator('.calm-greet-sub').textContent() || '').includes('Willow'));
  check('no strip for Willow (no meds → nothing-pressing focus)', await page.locator('.calm-seg').count() === 0);
  check('Willow meal log untouched', await page.evaluate(() => localStorage.getItem('vb_calm_meals_p2')) === null);

  console.log('— Switch back to Percy —');
  await page.locator('.calm-pet-chip', { hasText: 'Percy' }).click();
  await page.waitForTimeout(400);
  check('Percy strip remembers today', await page.locator('.calm-seg.on').count() === 1);

  console.log('— Bridge share (real message + pinned persistence) —');
  await page.locator('.calm-nav-item', { hasText: 'Visits' }).click();
  await page.waitForTimeout(200);
  check('visit prep shows upcoming appt', (await page.locator('.calm-visit-clinic').first().textContent().catch(() => '')).includes('Dr. Rodgers'));
  await page.locator('[data-action="calm-sub"][data-sub="bridge"]').click();
  await page.waitForTimeout(200);
  check('bridge doc shows meds', (await page.locator('.calm-doc').textContent().catch(() => '')).includes('Gabapentin'));
  check('not shared yet', await page.locator('.calm-shared-confirm').count() === 0);
  await page.locator('[data-action="calm-toggle-share"]').click();
  await page.waitForTimeout(300);
  check('share confirmation shown', await page.locator('.calm-shared-confirm').count() === 1);
  const sharedStored = await page.evaluate(() => localStorage.getItem('vb_calm_shared_c1'));
  check('share pinned to visit in localStorage', !!sharedStored && JSON.parse(sharedStored).visit !== null, sharedStored);
  await page.locator('[data-action="calm-back"]').click();
  await page.locator('.calm-nav-item', { hasText: 'Buddy' }).click();
  await page.waitForTimeout(200);
  await page.locator('[data-action="calm-sub"][data-sub="message"]').first().click();
  await page.waitForTimeout(200);
  check('approval message landed in thread', (await page.locator('.calm-thread').textContent().catch(() => '')).includes('please share it with Dr. Rodgers'));

  console.log('— Deep-link fold (push-notification tap → calm, not classic) —');
  await page.evaluate(() => {
    navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'NOTIFICATION_CLICK', caseId: 'c2' } }));
  });
  await page.waitForTimeout(500);
  check('still inside calm shell (no classic topbar)', await page.locator('.calm-app').count() === 1 && await page.locator('.topbar').count() === 0);
  check('folded to calm message screen', await page.locator('.calm-composer, .calm-thread-readonly').count() >= 1);
  check('active pet followed the deep link to Willow', (await page.locator('.calm-msg-sub').textContent().catch(() => '')).includes('Vet Buddy'));
  const willowActive = await page.evaluate(() => {
    // Back out to Today and confirm the switcher followed the caseId
    document.querySelector('[data-action="calm-back"]')?.click();
    document.querySelector('.calm-nav-item')?.click();
    return new Promise(r => setTimeout(() => r(document.querySelector('.calm-pet-chip.active')?.textContent || ''), 200));
  });
  check('pet switcher shows Willow active after deep link', willowActive.includes('Willow'), willowActive);
  await page.locator('.calm-pet-chip', { hasText: 'Percy' }).click();
  await page.waitForTimeout(400);

  console.log('— Care tab + reload persistence —');
  await page.locator('.calm-nav-item', { hasText: 'Care' }).click();
  await page.waitForTimeout(200);
  check('care head shows pet name', (await page.locator('.calm-care-name').textContent().catch(() => '')) === 'Percy');
  check('meds listed in daily care', (await page.locator('.calm-row-k').first().textContent().catch(() => '')).includes('Gabapentin'));
  await page.screenshot({ path: path.join(__dirname, 'calm-care.png') });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.calm-app', { timeout: 8000 }).catch(() => {});
  check('reload lands back on calm home', await page.locator('.calm-app').count() === 1);
  check('meal log survives reload', await page.locator('.calm-seg.on').count() === 1);
  await page.locator('.calm-nav-item', { hasText: 'Visits' }).click();
  await page.locator('[data-action="calm-sub"][data-sub="bridge"]').click();
  await page.waitForTimeout(300);
  check('share confirmation survives reload (same visit)', await page.locator('.calm-shared-confirm').count() === 1);
  await page.locator('[data-action="calm-back"]').click();
  await page.locator('.calm-nav-item', { hasText: 'Today' }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(__dirname, 'calm-today.png') });

  console.log('— Console/page errors —');
  check('no unexpected JS errors', errors.length === 0, errors.join(' | '));

  await browser.close();
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
