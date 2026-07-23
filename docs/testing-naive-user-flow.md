# Testing: The Uninformed First-Time User Flow

A cognitive walkthrough of how someone who has **never used TypeSet** actually collides
with it — in their own words, at each point where the tool goes silent and they have to
guess the next move. It doubles as a usability friction map: every ❌-**Silent** row below
is a place the tool fails with *zero feedback*, which is where first-timers churn.

Use it two ways:
- **As a test script** — sit a real first-timer down, give them the persona's goal, and
  record what they *say* and *do* at each scene. Don't coach them. The gaps are the data.
- **As a friction ledger** — the summary table maps each silent wall to the fix that would
  close it (see `design-decisions.md`).

---

## The persona

> **Dana** — product-minded, ships real web projects, does **not** write CSS by hand and
> **cannot** open DevTools without fear (this is TypeSet's stated user, per `WHY.md`). Dana
> has a Claude Code / Conductor session open because an agent builds their site. Dana heard
> "TypeSet lets you drag your type until it looks right and the agent writes it" and wants to
> try it. **Dana has read no docs.** Dana's mental model is a design app: *I change something,
> it's saved.*

**The goal we give the tester:** *"Make the main heading on your homepage a bit smaller and
a little lighter, and have it actually land in the code."*

That's it. Everything below is Dana trying to reach that goal with no map.

---

## Preconditions — run the walkthrough in BOTH states

The flow diverges hard depending on whether the machine is set up. Test both; a real
first-timer is almost always **Cold**.

- **Cold** — TypeSet has never been installed. No daemon, no MCP server registered, no
  `CLAUDE.md` instructions, no `<script>` tag in the project. (The true first-run.)
- **Warm** — someone ran `npx typeset-mcp install` at some point (daemon up on :8800, MCP
  registered in `~/.claude.json`, `CLAUDE.md` section present), but *this* project's HTML has
  no overlay tag and Dana knows none of the workflow.

Quick state check for the tester (not for Dana):
```sh
curl -s http://127.0.0.1:8800/health          # daemon up? {"ok":true,...}
claude mcp list | grep typeset                 # MCP registered?
grep -c "typeset:start" ~/.claude/CLAUDE.md    # agent instructions present? (1 = yes)
```

---

## The walkthrough

Each scene: what Dana **says/does** → what they **expect** → what **actually happens today**
→ the **mental-model gap** → how they **recover** → whether it's **Silent** (fails with no
feedback) → a tester **check**.

### Scene 1 — "Spin up the website I'm working on"

- **Dana says:** *"Spin up the site I'm working on."* (or clicks their own `npm run dev`)
- **Expects:** the site opens and the TypeSet panel is just... there. Dana was told TypeSet
  "runs on your page."
- **Actually (Cold & Warm):** the dev server starts, the page loads, and **nothing
  TypeSet-related appears.** There is no `<script>` tag in the HTML, so no overlay mounts.
- **Gap:** Dana thinks TypeSet is an app that's "on," like a browser extension. They don't
  know it's a script that has to be *added to this specific page*.
- **Recovers by:** noticing the absence and asking for it (Scene 2). Some users won't even
  get here — they'll assume it's broken and give up.
- **Silent?** ❌ **Yes** — a blank page is indistinguishable from "it's not working."
- **Check:** Did Dana realize *on their own* that something was missing, or did they sit
  waiting? Time-to-realization is the metric.

### Scene 2 — "Where's the typeset thing? Add the typeset tool"

- **Dana says:** *"I don't see the typography tool — add it"* / *"where's the overlay?"* /
  *"add typeset to this page."*
- **Expects:** the agent flips a switch and the panel appears.
- **Actually — WARM:** the agent (per `CLAUDE.md`) runs `pwd`, injects
  `<script src="https://32lngs-js.github.io/typeset/typeset-overlay.js" data-project="<abs path>"></script>`,
  calls `set_typeset_project(<pwd>)`, HMR reloads, and a floating **T** dial appears. ✅
- **Actually — COLD:** the agent **has no `typeset` tools** (MCP was never registered) and no
  `CLAUDE.md` instructions telling it what "typeset" means. Best case it guesses and adds the
  script tag from memory/the web; likely case it says *"I don't have a TypeSet tool
  installed."* Now Dana is stuck at meta-setup they didn't know existed:
  `npx typeset-mcp install` **must run once, and then a brand-new session must be opened
  before any `typeset` tool exists** (MCP servers load only at session start).
- **Gap (Cold):** Dana thinks "add the tool" is one step. It's actually: install a daemon →
  restart the agent session → *then* add a script tag. Three steps, two of them invisible.
- **Recovers by:** running install, opening a fresh session, re-asking. This is the single
  biggest first-run cliff.
- **Silent?** ⚠️ **Partly** — the agent *can* say "not installed," but whether it does
  depends on the model connecting "typeset" to the missing MCP server. The session-restart
  requirement is easy to miss even after install.
- **Check:** In Cold, how many turns until the overlay is on the page? Did the agent tell
  Dana a new session was required, or did Dana keep asking in a session that can never see the
  tools?

### Scene 3 — First scrub, then a reflexive refresh

- **Dana does:** clicks the big heading, drags the size chip down, drags weight to ~450.
  Looks great in the browser. Then — out of pure habit — **refreshes the page.**
- **Expects:** the smaller/lighter heading persists. It's saved, right?
- **Actually:** the heading **snaps back to the original.** TypeSet edits are inline DOM
  styles that reset on reload *by design* (`WHY.md`: explore is ephemeral, writing to source
  is a separate, deliberate step).
- **Gap:** the core model — *scrubbing is exploration, not saving* — is completely non-obvious
  to someone whose reference is Figma/Canva where changes are the document. Dana concludes
  "it didn't work" and loses trust.
- **Recovers by:** learning not to refresh, and that a **Copy** or **watch** step is what
  makes it real. Nothing on-screen teaches this.
- **Silent?** ❌ **Yes** — the refresh silently discards work with no "you have unsaved
  changes" warning.
- **Check:** Did Dana refresh and panic? Did anything tell them the edit was exploratory?

### Scene 4 — "How do I save this?"

- **Dana says:** *"Okay how do I save it / make it stick?"* (or just keeps scrubbing,
  waiting for it to persist)
- **Expects:** a Save button, or that it auto-saves.
- **Actually:** there are two real paths and Dana was told neither:
  1. **Copy** — the toolbar Copy button POSTs the change to the daemon (`:8800/commit`) and
     queues it for the agent. (Copy is the manual, agent-does-the-write path.)
  2. **Watch mode** — the broadcast/📡 toggle in the toolbar: when ON, finishing a scrub
     auto-commits, no Copy click. This is the intended hands-free path — but it only lands in
     code if an agent is *actually watching* (Scene 5).
- **Gap:** "Copy" reads like "copy CSS to clipboard" (which is what it did in the standalone
  tool), not "send this to my agent to write." The watch toggle is an unlabeled icon. Neither
  says "this is how you save."
- **Recovers by:** clicking Copy or the watch toggle — usually by trial and error.
- **Silent?** ⚠️ **Partly** — the buttons exist but don't self-explain their role in a
  save-to-code flow.
- **Check:** Did Dana find Copy/watch unaided? What did they *think* "Copy" would do?

### Scene 5 — The scrub goes nowhere (the silent dead-scrub)

- **Dana does:** turns on watch mode (or clicks Copy), scrubs the heading, and switches to
  their editor / refreshes to see the code change.
- **Expects:** the source file now has the new size/weight.
- **Actually — the failure that matters most:** the change is **queued in the daemon but
  never applied**, because **no agent is in the watch loop for this project.** This happens
  when:
  - the agent's `watch_typeset_changes` auto-enter (v0.1.15) didn't fire — it's a heuristic
    buried in a large `CLAUDE.md`, and "spin up the site" often parses as a finish-and-idle
    task; **or**
  - the session went idle and a browser click *cannot* wake an idle chat (the fixed
    architectural wall); **or**
  - the session was never bound (`set_typeset_project`) so it's filtering the change out.
  The browser shows Dana's edit (inline DOM), so Dana believes it worked — but the source is
  untouched, and a refresh wipes the visual too.
- **Gap:** Dana has no way to distinguish "an agent is receiving my scrubs" from "I'm
  scrubbing into the void." The overlay's own watch pulse means "*I'm broadcasting*," not
  "*someone's listening*."
- **Recovers by:** going back to the chat and typing *"apply my typeset changes"* / *"watch
  for my edits."* One nudge fixes it — **if** Dana knows to do that. A first-timer usually
  doesn't and concludes the tool is broken.
- **Silent?** ❌ **Yes — this is the highest-severity silent wall.** (It's the same
  silent-missed-write class as the v0.1.12 bug, now at the whole-session level.)
- **Check:** When no agent is watching, was there *any* signal to Dana? (Today: no. This is
  what the proposed watch-liveness indicator — ledger row A — exists to fix.)

### Scene 6 — "I clicked Copy and nothing happened" (Cold-daemon variant)

- **Dana does:** clicks Copy.
- **Actually (if the daemon isn't running — Cold, or launchd not loaded):** the overlay's
  `POST http://127.0.0.1:8800/commit` fails. The change goes nowhere; the toolbar gives no
  clear error.
- **Gap:** Dana can't tell a dead daemon from a missing agent from a routing miss — all three
  present identically as "nothing happened."
- **Recovers by:** (tester) `curl :8800/health`; (Dana) can't, realistically.
- **Silent?** ❌ **Yes.**
- **Check:** `curl -s :8800/health` before the scene; note whether the overlay surfaces the
  failed POST at all.

### Scene 7 — Wrong chat grabs it (parallel-workspace variant)

- **Setup:** Dana has two Conductor workspaces open (common power-user state). The overlay tag
  on this page lacks `data-project`, so edits route by page origin (e.g. `localhost:5173`)
  instead of the project path.
- **Actually:** another session — or no session — matches the change; the chat Dana is
  looking at never sees it.
- **Gap:** invisible cross-talk; Dana has no concept of "routing."
- **Silent?** ❌ **Yes.** Lower priority for a *true* first-timer (usually one chat), but the
  first thing to break as they scale up.
- **Check:** Does the injected tag carry `data-project=<abs path>`? (It should, per Scene 2.)

### Scene 8 — It worked! …and now it ships to production

- **Dana does:** the edit landed in code (great), Dana commits and deploys — with the
  `<script src="…/typeset-overlay.js">` tag still in the HTML.
- **Actually:** the overlay now loads for **every real visitor** in prod.
- **Gap:** "remove before shipping" lives in an HTML comment and the docs Dana never read.
- **Silent?** ❌ **Yes** — nothing stops the deploy.
- **Check:** Did anything (agent, lint, the tag itself) warn before ship?

---

## Friction summary — every place it goes silent

Ranked by how badly it breaks a first-timer. "Silent" = fails with no feedback.

| # | Scene | What Dana experiences | Silent? | Severity | Closes with |
|---|-------|-----------------------|:-------:|:--------:|-------------|
| 1 | 5 | Scrubs, browser changes, **code never updates** (no agent watching) | ❌ | **P0** | Watch-liveness indicator (ledger row A): overlay shows green=agent receiving / amber="no agent — type 'watch' in your chat" |
| 2 | 3 | Refresh silently **discards** the edit | ❌ | **P0** | An "exploratory — Copy/watch to keep" hint on first edit; or an unsaved-changes cue |
| 3 | 2 (Cold) | "Add the tool" is secretly install → **restart session** → tag | ⚠️ | **P0** | Agent recognizes "typeset" when unregistered and states the install + new-session requirement; or a first-run onboarding line |
| 4 | 1 | Blank page = "is it broken?" (no tag on page) | ❌ | P1 | Agent proactively offers to add the overlay when starting a frontend dev session |
| 5 | 4 | No obvious **Save**; "Copy" reads as clipboard | ⚠️ | P1 | Label/tooltip the save path; make watch state legible |
| 6 | 6 | Copy does nothing (**daemon down**) | ❌ | P1 | Overlay surfaces a failed `/commit` POST ("can't reach TypeSet daemon") |
| 7 | 7 | Wrong/no chat gets the edit (routing) | ❌ | P2 | Always inject `data-project`; overlay shows bound-project |
| 8 | 8 | Overlay **ships to prod** | ❌ | P2 | Pre-ship warning / self-removing tag in prod builds |

**The pattern:** a first-timer hits **4–6 silent walls before a single value reaches code**,
and the two worst (no-listener scrub, refresh-discards) both stem from the same missing thing
— *the tool never tells Dana whether their edit is being received or is merely exploratory.*
That is the strongest evidence for prioritizing the watch-liveness channel (row A): it turns
the #1 and, indirectly, the #5 walls from silent into one-glance-obvious.

---

## For contrast: the happy path (everything already set up)

What "good" looks like, so the tester knows the target:

1. Warm machine. Dana opens a chat in the project and says *"spin up my site."*
2. Agent starts the dev server, binds (`set_typeset_project(pwd)`), and **enters the
   `watch_typeset_changes` loop instead of going idle** (v0.1.15).
3. The page loads with the **T** dial (tag already present from a prior session).
4. Dana clicks the heading, turns on the 📡 watch toggle, scrubs size and weight.
5. On settle, the overlay auto-commits → daemon → the watching agent reads it, writes the
   source, calls `apply_typeset_change` → **Vite HMR repaints the real change in <1s.**
6. Dana keeps scrubbing; each settle lands in code hands-free. No Copy, no chat nudge, no
   refresh-loss.

Every silent wall above is a deviation from this path. The test measures how often, and where,
a first-timer falls off it.

---

## What the tester should record per run

- **State:** Cold or Warm (and the 3-line state check output).
- **Time-to-first-applied-value:** from "spin up the site" to a value actually in the source file.
- **Turn count & nudges:** how many messages Dana had to send; how many were recovery ("apply
  it", "add typeset", "why isn't it saving").
- **Silent-wall hits:** which of the 8 rows fired, and at each — *did Dana recover unaided, ask
  the agent, or give up?*
- **Trust events:** any moment Dana concluded "it's broken" (especially the Scene 3 refresh and
  the Scene 5 dead-scrub).
- **Verbatim quotes:** capture Dana's exact words at each wall — they're the naming for the
  next fix.

The single number that matters: **can a first-timer, with no docs, get one value from
scrubber to source — and does the tool ever tell them when it's *not* working?** Today the
answer to the second half is largely *no*, and that's the thing to fix before this is
demoable to a real WHY.md designer.
