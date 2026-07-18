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

## Fonts

Includes a curated set of Google Fonts plus self-hosted Söhne (Klim Type Foundry). The Söhne files are not included in this repo — add your own licensed copies to `fonts/sohne/` using the weight naming convention in `index.html`.

## Stack

Vanilla HTML, CSS, and JavaScript. No dependencies, no framework, no build step. The entire tool is one file.
