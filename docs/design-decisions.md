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
