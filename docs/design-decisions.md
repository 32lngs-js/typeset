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
