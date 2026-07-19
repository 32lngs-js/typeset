# TypeSet

A browser tool for exploring typography in real time.

Open it alongside any page you're designing. Click a text element, drag the label chips to scrub values, and copy the resulting CSS when it feels right.

**[Launch TypeSet →](https://32lngs-js.github.io/typeset)**

---

## What it does

- Scrubber controls for size, weight, line height, letter spacing, and position
- Font library including Söhne, Newsreader, Inter, Space Grotesk, DM Serif Display, Cormorant Garamond, Geist Mono, and more
- Minimizes to a floating T dial — stays out of your way until you need it
- Light and dark panel modes
- One-click CSS copy

## Intent

Most typography decisions happen in code, not design tools. You set a value, reload the page, adjust, reload again. TypeSet shortens that loop — scrub directly on the live element, see the change, copy the CSS, move on.

Inspired by [Dialkit](https://joshpuckett.me/dialkit) and [Agentation](https://agentation.com).

## Use it on your dev project

Add one line to your HTML during development — remove it before shipping:

```html
<script src="https://32lngs-js.github.io/typeset/typeset-overlay.js"></script>
```

The TypeSet panel appears in the corner of your page whenever you run a dev server. Click any text element, scrub the sliders, click Copy when it feels right. No install, no build step, nothing to configure.

**With a coding agent (Claude Code):** install `typeset-mcp` once and changes flow directly to the agent — no copy-paste. See [`mcp-server/README.md`](mcp-server/README.md).

## Use it on any page (overlay)

To inspect pages you don't control — staging, live sites, other people's projects:

- **Bookmarklet:** see `bookmarklet.txt` — one bookmark in your browser bar, click to toggle TypeSet on any page.
- **Console:** paste the contents of `typeset-overlay.js` into DevTools on the target page.

Edits are inline styles (they reset on reload — Copy is how you keep them). Some sites block injected scripts via CSP; console-paste is the fallback there.

## Fonts

Includes a curated set of Google Fonts plus self-hosted Söhne (Klim Type Foundry). The Söhne files are not included in this repo — add your own licensed copies to `fonts/sohne/` using the weight naming convention in `index.html`.

## Stack

Vanilla HTML, CSS, and JavaScript. No dependencies, no framework, no build step. The entire tool is one file.