const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { C, variants, stories } = require('./variants.js');

const ROOT = path.resolve(__dirname, '..');
const FONTS = fs.readFileSync(path.join(__dirname, 'fonts', 'fonts-inline.css'), 'utf8');
const LOGO = fs.readFileSync(path.join(__dirname, 'logo.b64'), 'utf8').trim();
const OUT = path.join(ROOT, 'output');
fs.mkdirSync(OUT, { recursive: true });

function html(v) {
  const w = v.w || 1080, h = v.h || 1080;
  const body = v.body.replace(/__LOGO__/g, LOGO);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${FONTS}
* { margin:0; padding:0; box-sizing:border-box; }
html,body { width:${w}px; height:${h}px; }
.canvas { position:relative; width:${w}px; height:${h}px; background:${C.linen};
          overflow:hidden; }
.stage { width:100%; height:100%; }
.logo { display:block; object-fit:contain; border-radius:18px; }
.url { font-family:'DM Sans'; font-weight:500; font-size:25px; letter-spacing:.005em;
       color:${C.ink}; white-space:nowrap; }
.url .u-sep { color:${C.sage}; margin:0 .5em; }
.url .u-web { font-weight:600; color:${C.sage}; }
${v.css}
${v.footerCss}
</style></head><body><div class="canvas">${body}</div></body></html>`;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  });
  const all = [...variants, stories];
  const results = [];
  for (const v of all) {
    const w = v.w || 1080, h = v.h || 1080;
    const file = path.join(__dirname, `${v.name}.html`);
    fs.writeFileSync(file, html(v));
    const page = await browser.newPage({
      viewport: { width: w, height: h },
      deviceScaleFactor: 2,
    });
    await page.goto('file://' + file);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(120);

    // Overflow / clipping + collision check
    const overflow = await page.evaluate(() => {
      const c = document.querySelector('.canvas');
      const cr = c.getBoundingClientRect();
      const problems = [];
      const sel = '.line1,.line2,.subhead,.kicker,.url,.logo';
      const els = [...document.querySelectorAll(sel)];
      const rects = els.map(el => ({ cls: el.className, r: el.getBoundingClientRect() }));
      // edge overflow
      rects.forEach(({ cls, r }) => {
        if (r.left < -0.5 || r.top < -0.5 || r.right > cr.width + 0.5 || r.bottom > cr.height + 0.5) {
          problems.push({ type: 'overflow', el: cls, l: Math.round(r.left), t: Math.round(r.top),
                          r: Math.round(r.right), b: Math.round(r.bottom) });
        }
      });
      // pairwise overlap
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i].r, b = rects[j].r;
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 2 && oy > 2) {
          problems.push({ type: 'overlap', a: rects[i].cls, b: rects[j].cls,
                          ox: Math.round(ox), oy: Math.round(oy) });
        }
      }
      return { cw: cr.width, ch: cr.height, problems };
    });

    const outName = v.name === 'stories-editorial'
      ? 'vetbuddies-tagline-post-stories.png'
      : (v.name === variants[0].name
          ? 'vetbuddies-tagline-post.png'          // primary deliverable = variant 1
          : `vetbuddies-tagline-post-${v.name}.png`);
    const outPath = path.join(OUT, outName);
    await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: w, height: h } });
    await page.close();
    results.push({ name: v.name, outName, expected: `${w}x${h}`, overflow, outPath });
  }
  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(results, null, 2));
  for (const r of results) {
    const ok = r.overflow.problems.length === 0 ? 'OK' : 'OVERFLOW!';
    console.log(`${r.outName}  logical=${r.overflow.cw}x${r.overflow.ch}  ${ok}`);
    if (r.overflow.problems.length) console.log('   ', JSON.stringify(r.overflow.problems));
  }
})();
