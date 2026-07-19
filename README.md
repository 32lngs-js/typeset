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

## Usage

No install, no build step. Open `index.html` in a browser.

To use it on your own page, open both files side by side — TypeSet in one tab, your page in another. Use the Copy button to transfer values.

## Use it on any page (overlay)

`index.html` is the standalone demo. To inspect a *real* project's typography, use the injectable overlay — `typeset-overlay.js`. It mounts inside a Shadow DOM (so the host page's CSS can't touch it and vice versa), lets you click any text element on the page to edit it live, and Copy CSS emits real `selector { ... }` blocks you can paste into that project's stylesheet.

- **Bookmarklet:** see `bookmarklet.txt` — one bookmark, click to toggle on any page.
- **Console:** paste the contents of `typeset-overlay.js` into DevTools on the target page.
- Re-run to toggle it off. Edits are inline styles (they reset on reload — Copy CSS is how you keep them). Picked fonts must be web-loaded or they fall back. Some sites block injected scripts via CSP; console-paste is the fallback there.

## Fonts

Includes a curated set of Google Fonts plus self-hosted Söhne (Klim Type Foundry). The Söhne files are not included in this repo — add your own licensed copies to `fonts/sohne/` using the weight naming convention in `index.html`.

## Stack

Vanilla HTML, CSS, and JavaScript. No dependencies, no framework, no build step. The entire tool is one file.

---

## Design decisions

### Closing the handoff loop

The current workflow has three phases: (1) scrub to find the right value, (2) copy CSS, (3) paste into a text agent or code editor and apply the change. Phase 2 is the friction point — a manual carry between tools.

The next version of TypeSet collapses that handoff. The scrubber stays aware of the CSS selector and source file path from the start. When the user commits a value, the export is already a diff — not a CSS block to paste, but a file change to approve. The human's role is unchanged: sensory judgment, stopping the scrubber at the right value. The agent's role is unchanged: write the file. What disappears is the middle step.

### How the agent initiates automatically

The user shouldn't have to copy, switch tools, paste, and submit. Two mechanisms that close this:

- **File-watch hook (current path):** TypeSet writes committed values to a well-known file (`.context/typeset-pending.json`) on commit gesture. A Claude Code hook fires on that file change and wakes the agent automatically. The file system is the message bus.
- **MCP push (long-term shape):** TypeSet fires a tool call directly into the MCP stream when the user commits. The agent receives it as an event rather than polling.

### Confirmation: HMR is the signal

The agent doesn't need to ask whether it acted correctly — HMR handles that. The agent writes the file, Vite pushes the update, the browser reflects it in under a second. The visual confirmation is the browser itself. What the agent should do is echo back what it wrote (selector, property, old value → new value, line number) as a diff the user approves *before* the write, not after.

### Badge behavior: persist as a session changelist

Badges shouldn't auto-dismiss on apply. They should function as a running changelist: what moved, by how much, in what order. Auto-dismissing loses the trail exactly when you need it — while you're still iterating and want to see what's in flight.

The right behavior: the commit gesture freezes the badge into an "applied" state (grayed, not gone). The agent writes the file. HMR confirms visually. Badges clear explicitly when the session is over — not when each individual change lands.
