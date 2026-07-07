# Vet Buddies — Instagram tagline post

Typography-led promotional assets built as HTML/CSS and screenshotted with
Playwright (headless Chromium, `deviceScaleFactor: 2`).

## Deliverables (in `../output/`)

| File | Layout | Logical | Actual @2x |
| --- | --- | --- | --- |
| `vetbuddies-tagline-post.png` | Centered classic (primary) | 1080×1080 | 2160×2160 |
| `vetbuddies-tagline-post-left-editorial.png` | Left-aligned editorial | 1080×1080 | 2160×2160 |
| `vetbuddies-tagline-post-oversized-poster.png` | Oversized-type poster | 1080×1080 | 2160×2160 |
| `vetbuddies-tagline-post-stories.png` | Stories (editorial, vertical) | 1080×1920 | 2160×3840 |

## Brand system

- Background linen `#F0EBE0`, ink `#1C1A18`, sage `#6B8F5E`, burgundy `#7A3B4E`
  (one accent max — the period after "We don't.")
- Headline: Lora (serif), "We don't." in italic. Subhead/small text: DM Sans.
- Fonts and the logo are inlined as base64 so renders are network-independent
  and deterministic.

## Rebuild

```bash
npm install playwright        # from repo root
node build/build.js
```

`build/build.js` writes each variant's HTML, screenshots it, verifies every
PNG is exactly 1080×1080 (or 1080×1920) logical pixels, and asserts no text is
clipped at the canvas edge or overlapping another element.

`build/fonts/fonts-inline.css` (Lora + DM Sans, base64 woff2) and
`build/logo.b64` (the Vet Buddies badge from `icon-512.png`) are committed so
the build reproduces offline. Regenerate fonts from Google Fonts only if you
need to change weights.
