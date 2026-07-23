# UX — User Flow

The canonical, intended experience of TypeSet's hands-free loop: from opening a page to
watching a scrubbed value land in the source code. Companion to
[`testing-naive-user-flow.md`](testing-naive-user-flow.md) — that doc maps where a first-timer
*hits friction*; this one is the happy path and the panel's **state model**.

---

## The mental model: two switches

For a browser edit to reach your source, two independent things must both be true:

- **Browser watch (📡)** — the overlay toggle. When on, each settled scrub auto-commits to the
  local queue. The overlay can turn this on itself.
- **Agent watch** — your Claude chat is parked in the `watch_typeset_changes` loop, draining that
  queue into the file. **The overlay cannot turn this on** — only a message in your chat can,
  because a Claude chat is turn-driven and nothing external wakes an idle one.

So the entire UX is about (a) getting switch #2 on with one paste, and (b) making its state
legible without cluttering the panel.

---

## Sync-status model — two states, not three

**Guiding principle: surface UI only when the user must act.** A working state needs no standing
UI — the proof that it's working is that *edits land* (HMR) and the 📡 button is pulsing. A badge
that announces "it's working" while it's working is clutter.

| Situation | 📡 button | Panel status element |
|---|---|---|
| **Off** | grey, still | *nothing* (broadcasting is off by the user's choice) |
| **On, not synced** | pulsing | **blue box** — "For live edits actioned via MCP, paste in your chat:" + `watch my TypeSet edits` (click-to-copy) |
| **On, just synced** | pulsing | box briefly flips to **green "✓ Live"** (~2s) then **fades** |
| **On, synced (steady)** | pulsing | *nothing* — clean panel |

The single standing element is the **blue box**, and it appears only when action is needed
(watch is on but no agent is applying). Everything else is quiet.

**Read it this way:**
- **Blue box present → act** (paste the phrase to pair your agent).
- **Blue box absent, 📡 pulsing → you're synced.** Green is a *moment* (the confirmation of the
  transition), not a permanent fixture.

Why not a persistent "Live" badge: it would sit in the panel nagging you about the fact that
everything is fine. The absence of the blue box already carries that information, and the green
flash covers the "did it just work?" moment.

---

## The flow

### Phase 0 — One-time setup (ever)
1. `npx typeset-mcp install` (once, ever). Starts the local Connection service (daemon on `:8800`),
   registers the MCP server, and writes the agent instructions to `~/.claude/CLAUDE.md`.
2. Open a **fresh** chat afterward (MCP tools load at session start).

### Phase 1 — Per session (the agent does this for you)
3. In your project's chat, say **"spin up my site."**
4. In that same turn the agent: ensures the overlay `<script>` tag (with `data-project=<pwd>`) is
   on the page, binds this chat to the project (`set_typeset_project`), and enters the
   `watch_typeset_changes` loop — staying in it rather than going idle.
5. Open your page → the floating **T** dial appears → click it → the panel expands. First run: the
   **coach** card (① Click any text · ② Drag the values in this panel · ③ Turn on Watch to send
   edits to your agent).

### Phase 2 — Go live (in the browser)
6. Turn on **📡 Watch** — it starts pulsing. No agent is confirmed yet, so the **blue box** appears
   with the exact phrase to paste.
7. Click the phrase → it copies (icon flips to ✓) → paste into your Claude chat → send.
8. The agent recognizes **"watch my TypeSet edits"** → (re)enters the watch loop → begins
   heartbeating. Within ~3s the overlay detects it → the box flips to **green "✓ Live"** and fades.
   **You're synced.**

### Phase 3 — Edit (the core loop)
9. Click any text on the page → the panel expands to the sliders (a gentle, gradual expand;
   deselecting contracts the same way in reverse).
10. Drag a value → on settle (350 ms) it auto-commits → the watching agent reads it, writes it into
    the source, and Vite HMR repaints in <1s. The change is now **refresh-safe** — it's in the code.
11. Keep scrubbing. Hands-free: no box, 📡 pulsing = live.

### Recovery — the idle wall (the one irreducible friction)
- If a scrub stops landing, the chat most likely went **idle** (its turn ended). The overlay can't
  wake it. The **blue box reappears** → paste the phrase again → **green "✓ Live"** → hands-free again.
- The floor is therefore **one chat message per session** — usually the "spin up my site" you were
  going to send anyway. Truly zero-chat operation would require a headless applier the daemon
  launches (a deliberate product fork; see `design-decisions.md`).

---

## What the panel deliberately does NOT show

- **No persistent "connected/live" badge.** Absence of the blue box (with 📡 on) is the synced signal.
- **No warning when watch is off.** That's the user's deliberate choice, not an error state.
- The **gear → Settings** back-face still carries the explicit **Connection** (daemon health) and
  **Agent** (watching / not watching) readouts for when you want to check on purpose.

---

## Deploy note

The green "✓ Live" reflects a **real** agent only once the MCP heartbeat (`beat()`, v0.1.18+) is
published to npm and reinstalled. The overlay ships from GitHub Pages; the MCP + daemon ship via
npm publish + `npx typeset-mcp install`. Until then, the overlay's `/watching` poll returns "not
watching," so the loop can be exercised with a simulated heartbeat (see `design-decisions.md`).
