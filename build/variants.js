// Layout-specific CSS + HTML body for each variant.
// Shared brand tokens live in build.js.

const C = {
  linen: '#F0EBE0',
  ink: '#1C1A18',
  sage: '#6B8F5E',
  burgundy: '#7A3B4E',
};

// ---- Variant 1: Centered classic ----
const centered = {
  name: 'centered-classic',
  css: `
    .stage { display:flex; flex-direction:column; align-items:center; justify-content:center;
             text-align:center; padding:120px 110px 360px; }
    .kicker { font-family:'DM Sans'; font-weight:500; font-size:23px; letter-spacing:.42em;
              text-transform:uppercase; color:${C.sage}; margin-bottom:60px; }
    .headline { font-family:'Lora'; color:${C.ink}; line-height:1.02; }
    .line1 { font-weight:500; font-size:90px; letter-spacing:-.01em; white-space:nowrap; }
    .line2 { font-weight:600; font-style:italic; font-size:148px; letter-spacing:-.02em; margin-top:6px; }
    .dot { color:${C.burgundy}; }
    .rule { width:120px; height:2px; background:${C.burgundy}; margin:56px 0 44px; border:0; }
    .subhead { font-family:'DM Sans'; font-weight:400; font-size:34px; line-height:1.5;
               color:${C.sage}; max-width:760px; }
    .subhead em { font-style:italic; color:${C.ink}; }
  `,
  body: `
    <div class="stage">
      <div class="kicker">Vet Buddies</div>
      <div class="headline">
        <div class="line1">The vet visit ends.</div>
        <div class="line2">We don&rsquo;t<span class="dot">.</span></div>
      </div>
      <hr class="rule" />
      <div class="subhead">One dedicated Buddy who knows your pet&nbsp;&mdash;<br/>and asks <em>before you have to.</em></div>
    </div>
    <img class="logo logo-center" src="__LOGO__" alt="Vet Buddies" />
    <div class="url url-center">Create a free account<span class="u-sep">&middot;</span><span class="u-web">rodgersvetbuddies.com</span></div>
  `,
  footerCss: `
    .logo-center { position:absolute; bottom:118px; left:50%; transform:translateX(-50%); width:184px; height:184px; }
    .url-center { position:absolute; bottom:64px; left:50%; transform:translateX(-50%); }
  `,
};

// ---- Variant 2: Left-aligned editorial ----
const editorial = {
  name: 'left-editorial',
  css: `
    .stage { display:flex; flex-direction:column; align-items:flex-start; justify-content:center;
             text-align:left; padding:0 130px; }
    .kicker { font-family:'DM Sans'; font-weight:500; font-size:22px; letter-spacing:.4em;
              text-transform:uppercase; color:${C.sage}; margin-bottom:56px;
              display:flex; align-items:center; gap:28px; }
    .kicker::before { content:''; width:64px; height:2px; background:${C.sage}; display:inline-block; }
    .headline { font-family:'Lora'; color:${C.ink}; line-height:1.0; }
    .line1 { font-weight:500; font-size:96px; letter-spacing:-.015em; }
    .line2 { font-weight:600; font-style:italic; font-size:158px; letter-spacing:-.025em; margin-top:6px; }
    .dot { color:${C.burgundy}; }
    .subhead { font-family:'DM Sans'; font-weight:400; font-size:33px; line-height:1.55;
               color:${C.ink}; max-width:720px; margin-top:64px; padding-left:4px; }
    .subhead em { font-style:italic; color:${C.sage}; font-weight:500; }
  `,
  body: `
    <div class="stage">
      <div class="kicker">Vet Buddies</div>
      <div class="headline">
        <div class="line1">The vet visit ends.</div>
        <div class="line2">We don&rsquo;t<span class="dot">.</span></div>
      </div>
      <div class="subhead">One dedicated Buddy who knows your pet&nbsp;&mdash; and asks <em>before you have to.</em></div>
    </div>
    <img class="logo logo-left" src="__LOGO__" alt="Vet Buddies" />
    <div class="url url-right">Create a free account<span class="u-sep">&middot;</span><span class="u-web">rodgersvetbuddies.com</span></div>
  `,
  footerCss: `
    .logo-left { position:absolute; bottom:92px; left:130px; width:188px; height:188px; }
    .url-right { position:absolute; bottom:152px; right:130px; }
  `,
};

// ---- Variant 3: Oversized-type poster ----
const poster = {
  name: 'oversized-poster',
  css: `
    .stage { display:flex; flex-direction:column; align-items:center; justify-content:center;
             text-align:center; padding:96px 90px 300px; }
    .line1 { font-family:'Lora'; font-weight:500; font-size:68px; letter-spacing:.005em;
             color:${C.sage}; line-height:1.1; margin-bottom:14px; }
    .line2 { font-family:'Lora'; font-weight:600; font-style:italic; color:${C.ink};
             font-size:222px; line-height:.9; letter-spacing:-.03em; }
    .dot { color:${C.burgundy}; }
    .subhead { font-family:'DM Sans'; font-weight:400; font-size:32px; line-height:1.5;
               color:${C.ink}; max-width:800px; margin-top:60px; }
    .subhead em { font-style:italic; color:${C.sage}; font-weight:500; }
  `,
  body: `
    <div class="stage">
      <div class="line1">The vet visit ends.</div>
      <div class="line2">We don&rsquo;t<span class="dot">.</span></div>
      <div class="subhead">One dedicated Buddy who knows your pet&nbsp;&mdash;<br/>and asks <em>before you have to.</em></div>
    </div>
    <img class="logo logo-center" src="__LOGO__" alt="Vet Buddies" />
    <div class="url url-center">Create a free account<span class="u-sep">&middot;</span><span class="u-web">rodgersvetbuddies.com</span></div>
  `,
  footerCss: `
    .logo-center { position:absolute; bottom:104px; left:50%; transform:translateX(-50%); width:172px; height:172px; }
    .url-center { position:absolute; bottom:56px; left:50%; transform:translateX(-50%); }
  `,
};

// ---- Stories version (1080x1920) — editorial, vertically composed ----
const stories = {
  name: 'stories-editorial',
  w: 1080, h: 1920,
  css: `
    .stage { display:flex; flex-direction:column; align-items:flex-start; justify-content:center;
             text-align:left; padding:0 120px; height:100%; }
    .kicker { font-family:'DM Sans'; font-weight:500; font-size:24px; letter-spacing:.4em;
              text-transform:uppercase; color:${C.sage}; margin-bottom:64px;
              display:flex; align-items:center; gap:28px; }
    .kicker::before { content:''; width:72px; height:2px; background:${C.sage}; display:inline-block; }
    .headline { font-family:'Lora'; color:${C.ink}; line-height:1.0; }
    .line1 { font-weight:500; font-size:104px; letter-spacing:-.015em; }
    .line2 { font-weight:600; font-style:italic; font-size:176px; letter-spacing:-.025em; margin-top:8px; }
    .dot { color:${C.burgundy}; }
    .subhead { font-family:'DM Sans'; font-weight:400; font-size:38px; line-height:1.55;
               color:${C.ink}; max-width:760px; margin-top:80px; }
    .subhead em { font-style:italic; color:${C.sage}; font-weight:500; }
  `,
  body: `
    <div class="stage">
      <div class="kicker">Vet Buddies</div>
      <div class="headline">
        <div class="line1">The vet visit ends.</div>
        <div class="line2">We don&rsquo;t<span class="dot">.</span></div>
      </div>
      <div class="subhead">One dedicated Buddy who knows your pet&nbsp;&mdash; and asks <em>before you have to.</em></div>
    </div>
    <img class="logo logo-left" src="__LOGO__" alt="Vet Buddies" />
    <div class="url url-right">Create a free account<span class="u-sep">&middot;</span><span class="u-web">rodgersvetbuddies.com</span></div>
  `,
  footerCss: `
    .logo-left { position:absolute; bottom:110px; left:120px; width:216px; height:216px; }
    .url-right { position:absolute; bottom:182px; right:120px; }
  `,
};

module.exports = { C, variants: [centered, editorial, poster], stories };
