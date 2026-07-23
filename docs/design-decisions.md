# Design Decisions

## Closing the handoff loop

The current workflow has three phases: (1) scrub to find the right value, (2) copy CSS, (3) paste into a text agent or code editor and apply the change. Phase 2 is the friction point — a manual carry between tools.

The next version of TypeSet collapses that handoff. The scrubber stays aware of the CSS selector and source file path from the start. When the user commits a value, the export is already a diff — not a CSS block to paste, but a file change to approve. The human's role is unchanged: sensory judgment, stopping the scrubber at the right value. The agent's role is unchanged: write the file. What disappears is the middle step.

## How the agent initiates automatically

The user shouldn't have to copy, switch tools, paste, and submit. Two mechanisms that close this:

- **File-watch hook (current path):** TypeSet writes committed values to a well-known file (`.context/typeset-pending.json`) on commit gesture. A Claude Code hook fires on that file change and wakes the agent automatically. The file system is the message bus.
- **MCP push (long-term shape):** TypeSet fires a tool call directly into the MCP stream when the user commits. The agent receives it as an event rather than polling.

## Confirmation: HMR is the signal

The agent doesn't need to ask whether it acted correctly — HMR handles that. The agent writes the file, Vite pushes the update, the browser reflects it in under a second. The visual confirmation is the browser itself. What the agent should do is echo back what it wrote (selector, property, old value → new value, line number) as a diff the user approves *before* the write, not after.

## Badge behavior: persist as a session changelist

Badges shouldn't auto-dismiss on apply. They should function as a running changelist: what moved, by how much, in what order. Auto-dismissing loses the trail exactly when you need it — while you're still iterating and want to see what's in flight.

The right behavior: the commit gesture freezes the badge into an "applied" state (grayed, not gone). The agent writes the file. HMR confirms visually. Badges clear explicitly when the session is over — not when each individual change lands.

## Session routing: which chat owns the changes

The daemon writes one global queue (`~/.typeset-pending.json`) that every Claude session with the MCP loaded watches. With a single active session that is fine, because it is the only listener, so it actions everything. With multiple sessions open at once (the normal Conductor workflow, many workspaces in parallel) there is no binding between the browser page and the chat that set it up: all sessions receive the `resources/updated` notification and can race to apply the same change to their different repos.

Decision: route each change to the session whose project produced it, via an explicit token. When the agent adds the overlay to a page it (1) reads its project root (`pwd`), (2) injects the script tag with `data-project=<root>`, and (3) calls the `set_typeset_project` MCP tool with the same value. The overlay sends `project` with every commit; the daemon tags each queued change with it; each session filters `get_pending_changes` to its own token and only wakes on a matching change. An unbound session (no token set) still sees everything, which preserves the single-session and manual-POST paths.

The token is the agent's `pwd` rather than a hash, because the agent is the single source of truth for both sides of the binding, and an exact string match is the simplest thing that cannot drift. This restores the per-project affinity that existed in v0.1.4 (when the pending file lived at `process.cwd()/.typeset-pending.json`) without giving up the single global daemon that keeps one owner of port 8800 across parallel sessions. Shipped in v0.1.9.

## Queue hygiene: commit real changes, not inspection noise

The overlay commits every inline-styled property on copy, plus (previously) any `transform` left over from dragging an element to reposition it. Two problems showed up: most entries display `value === previousValue`, and position drags leak in as fake type changes. It read as "28 pending changes" when only two were real edits.

The `previousValue === value` display has a specific cause. The overlay reads `previousValue` from `getComputedStyle(el)` at copy time, but by then the element already carries the user's inline edit, so computed equals the new value. A first naive fix (v0.1.9) tried to filter with `s[js] !== cs[js]`; because computed always equals inline, that dropped EVERY change and silently broke Copy entirely (nothing reached the daemon). It was reverted immediately.

Decision: position drags are no longer queued as typography changes (transforms still land in the copied CSS block, just not in the agent queue), which shipped. Correct no-op detection and a truthful `previousValue` require snapshotting each element's computed style at SELECTION time, before any inline edit, and comparing against that snapshot; `trackEdited` runs only after the first style is applied, so it is too late to capture the original there. That is a tracked follow-up. Until then the overlay commits all scrubbed properties (functional, with mild noise), and the agent skips any change whose value already matches the file.

## Daemon lives in the npx cache (fragility to fix)

The launchd daemon is pointed at the `server.js` inside whichever npx cache directory `install` resolved. Clearing the npm cache (`~/.npm/_npx`) therefore breaks the daemon until the next `install`. This is acceptable for now, but the clean fix is for `install` to copy `server.js` to a stable location (for example `~/.typeset/server.js`) and point launchd there, so the daemon does not depend on an ephemeral cache path.

## Auto-bind: the chat claims its project without a ritual (v0.1.10)

v0.1.9 tied binding (`set_typeset_project`) to the phrase "add typeset to the page." But the overlay script tag persists in the HTML, so on a later session there is no natural "add" moment and exclusive ownership silently never happens. Worse, an overlay added before the routing feature carries no `data-project`, so its edits are tagged by page origin (e.g. `http://localhost:5177`) instead of the workspace path, and a chat scoped to the path never matches them.

Decision: binding is the agent's job, done automatically, not a user ritual. The agent runs `pwd` and calls `set_typeset_project` the first time TypeSet is relevant in a session (including on the first change notification), and it bakes `data-project=<pwd>` into the overlay tag once per project (adding the attribute to an older tag if absent). The token on both sides is the workspace absolute path, so it is stable and unique. `get_pending_changes` now prints each change's project so ownership is legible while a session is still unbound.

This maps onto the real workflows: several pages of one project collapse to one chat (one binding); several projects each route to their own chat; the port or origin is irrelevant because routing is on the path, not the URL. The user never invokes binding. They open a chat per site and the tool keeps them sorted underneath.

## Watch mode: closing the trigger gap (v0.1.11)

Routing and auto-bind still left one hard limit: a Claude Code chat is turn-driven. Clicking Copy queues an edit and the MCP server fires `resources/updated`, but Claude Code does not start an agent turn from that notification, and there is no hook type that wakes an idle session on an external file change. So nothing applied edits until the user prompted the chat, one nudge per Copy, which is too much friction.

Agentation solves the same constraint with a blocking `agentation_watch_annotations` tool ("block until new annotations appear, then collect a batch and return them") plus a one-time "watch mode" prompt: the agent parks inside the long-poll, which returns the instant an annotation arrives, applies it, and re-enters the wait, all inside a single turn.

Decision (v0.1.11): add `watch_typeset_changes`, a long-poll tool that resolves immediately if edits are already pending, otherwise blocks (`fs.watch` plus a 1s poll fallback) until an edit for this session's project arrives or a ~50s timeout (kept under the client's tool-call timeout so the agent loops). The CLAUDE.md instruction makes watch mode the default way to run: on first TypeSet contact the agent binds, then calls `watch_typeset_changes` in a loop, applying each batch. One prompt, then hands-free, and it costs almost nothing while idle because the block is server-side (tokens are spent only when an edit actually returns).

## Applying edits: trust the source, not the payload (v0.1.12)

The first real watch-mode session surfaced a silent missed write. The change read `font-size: 20.5px → 20.5px`, the CLAUDE.md said "skip no-op," so the agent marked it applied without writing anything. The source actually held a Tailwind `text-[30px]` class and the user had scrubbed to 20.5px. Two root causes: (1) `previousValue` is the browser's computed state, not the source file value, so it is not a valid basis for a skip decision and often equals the target; (2) the instruction leaned on it.

Decision: the summary now shows only the target `value` (no misleading `from → to`), and the CLAUDE.md tells the agent to decide skip-vs-write by reading the SOURCE, never the payload, and to call `apply_typeset_change` only once the file actually holds the value. Tailwind guidance is now explicit: a selector containing `text-[30px]` means the value is a utility class on the element, so change the class (`text-[20.5px]`), not a CSS rule. This makes the selection-time-snapshot previousValue fix unnecessary for correctness, since the agent no longer consults previousValue at all.

Also surfaced: the watch block dropped the MCP connection (`-32000 Connection closed`) at 50s. Lowered the default to 25s (under the client's tool-call timeout) and told the agent that a connection close during a wait is normal, so it should just call watch again.

## Overlay watch mode: the browser half of hands-free (v0.1.13)

Agent-side watch mode still left the browser needing a manual Copy per change. The overlay now has a watch toggle (a broadcast icon in the toolbar): when ON, finishing an edit auto-commits to the daemon, so the user never clicks Copy. Paired with the agent's `watch_typeset_changes` loop the whole thing is hands-free: scrub, auto-commit, agent applies, HMR. Copy stays as the secondary / no-agent path and hides while watch is live; state persists in localStorage.

Implementation: the auto-commit hooks `commitMark` (the single "an edit changed the selection" signal, so it covers sliders, fonts, and align), debounced 350ms so a continuous scrub commits once when it settles rather than on every frame. Each commit re-posts the full edited state, so the daemon now dedups `/commit` by selector+property+project (keeping the latest value) to stop duplicates piling up.

## Auto-enter watch mode (v0.1.14)

Even with agent-side and overlay watch modes, the user still had to type "watch mode" once to start the agent's loop. A Claude Code chat cannot be woken by a browser click (turns start only from user input, and nothing external wakes an idle chat), so a toggle can never START an idle agent. The reachable win: the agent enters watch mode on its own the first time design work is happening, so the user's first natural message starts it rather than a magic keyword.

Decision (v0.1.14): the CLAUDE.md instruction now tells the agent to enter watch mode proactively (bind, then loop `watch_typeset_changes`) as soon as the user is doing visual or typography work on a page with the overlay, without waiting to be asked. Because each watch call blocks ~25s and then yields, the agent stays responsive to other messages. Truly zero-chat operation (a designer who never opens a chat at all) would need a background applier that the toggle launches, or the daemon applying simple value edits itself; that is a deliberate product fork, not this instruction tweak.

Follow-up (v0.1.15): the first real auto-enter test failed. The user said "spin up the portfolio site" (overlay already on the page), then clicked the overlay watch toggle, and nothing watched. Two causes: the v0.1.14 trigger was "doing visual/typography work", but spinning up a site is setup rather than editing, so the agent did the task and went idle; and once idle, the toggle click could not restart it (the browser-cannot-wake-an-idle-chat wall). Fix: move the trigger earlier, to the START of the session. Starting the dev server or opening a page with the overlay now means "enter watch mode immediately and do not go idle". The toggle still cannot wake an idle chat; the fix is to never let the agent reach idle at the top of a design session.

## Overlay auto-appears + is prod-safe: match the Agentation/Dialkit wiring, keep it stack-agnostic (v0.1.16)

The recurring first-run friction ("spin up the site, nothing appears") is just the overlay `<script>` tag not being on the page yet. Tools like Agentation/Dialkit avoid this by wiring their overlays into the app source (a React component in `main.jsx`), so they mount on every dev load with zero setup — at the cost of being framework-specific and, unless gated on `import.meta.env.DEV`, shipping to production.

TypeSet's `<script>` tag already gives the same "persists in the repo, auto-appears every dev load" property, and does so for *any* stack (vanilla, React, Vue, no-code) — which the React-component approach cannot. So rather than adopt their coupling, we took the two things that were actually missing:

1. **Auto-add the tag (instruction).** The CLAUDE.md watch-mode trigger now tells the agent, at the START of a design session (spin up / open a frontend page), to first ensure the overlay tag with `data-project=<pwd>` is present — adding it if missing — then bind and watch. Making the overlay appear is now an agent behavior, not something the user has to notice is absent.

2. **Prod-leak guard (overlay).** The one genuine advantage of the `import.meta.env.DEV` pattern is that the overlay is stripped from production. A raw `<script>` tag can't be tree-shaken, so the overlay now guards itself at mount: loaded via a wired `data-project` tag on a production-like host, it self-disables. The guard keys on `data-project` (only the agent-wired tag carries it), so the bookmarklet and console-paste paths — explicit gestures used to inspect *live* sites — always run. A dev-host allowlist (localhost, 127.0.0.1, ::1, `*.local`/`.localhost`/`.test`, private-LAN ranges, `file://`) defines "dev"; anything else is treated as production. `data-force` on the tag overrides the guard for LAN/tunnel dev and demos. This makes "remove before shipping" optional rather than required.

Deliberately NOT done: adopting the npm/`main.jsx` component wiring as the *primary* mechanism. It would make TypeSet React-only and evict the no-code/any-stack builder who is its stated user (`WHY.md`), while adding setup (a dep + a Vite `define` to recover the project path) rather than removing it. An official `@typeset/vite-plugin` remains a possible *second* distribution channel for the React/Vite segment, deferred until that segment is onboarded at volume. Neither change touches the top remaining friction — a scrub going nowhere when no agent is watching (the silent dead-scrub); a watch-liveness indicator is tracked separately and still outranks this.

## First-run coach, settings, and the watch-liveness loop (v0.1.16–0.1.17)

The overlay grew a small onboarding + status layer so a first-timer can tell what is happening:

- **First-run coach** — a one-time card (dismissal persists) teaching the loop: click text → drag values → turn on Watch to send edits to the agent. It shares one "Show tips" setting with the hover tooltips (they are one feature).
- **Settings panel** — a header gear flips the pane to a back face (two-face 3D flip; the whole panel height animates in lockstep so there is no lag or blank-frame). It holds: Show tips, Routing (which project), Connection (daemon health), and Agent (watch-liveness). Labels are chosen for non-coders — "Connection", not "Daemon".
- **Prod-safety + look** — the frosted-glass `backdrop-filter` was dropped (it re-blurred scrolling content behind the fixed panel and shimmered) in favor of an opaque panel; and the overlay self-disables on production hosts via the `data-project` guard.

The **watch-liveness loop closes the silent-dead-scrub gap**. Two switches must both be on for an edit to reach code — the overlay Watch toggle (browser commits) and the agent's `watch_typeset_changes` loop (chat applies) — and nothing told the user whether switch #2 was live. Now the MCP server writes a heartbeat (`~/.typeset-watching.json`, keyed by project path or `*` when unbound, TTL 10s, refreshed every second while the watch call blocks); the daemon exposes `GET /watching?project=`; and the overlay polls it while Watch is on. When Watch is on but no agent is listening, an amber cue appears with the exact phrase to paste — "No agent watching — paste in your chat: `watch my TypeSet edits`" (a compact copy-to-clipboard field, Google-Cloud style), and the agent's instructions recognize that phrase as the explicit cue to (re)enter the watch loop. This is the recovery for the idle-chat wall.

Watch-default and button state went through a deliberate iteration. Defaulting Watch **ON** was tried (D1) but created a contradiction: the button pulsed a "live" heartbeat on every fresh load before any agent was paired, sitting above a "no agent" warning. An "armed but not pulsing" third state was considered and rejected as confusing. The resolution: Watch is **OFF by default** with a clean **two-state** button (off / on-and-pulsing). The user turns it on deliberately, and *that* is the moment the pairing prompt appears — a teachable beat, not a premature nag. Copy stays visible while Watch is off (the manual path), and the coach's "turn on Watch" step is accurate again.

Deploy coupling: this spans overlay (GitHub Pages) + daemon + MCP (`/watching` endpoint, heartbeat), so the daemon and MCP must be updated (reinstall) for the indicator to read true; until then the overlay's poll 404s and shows "Not watching".
