# TypeSet MCP Server

TypeSet is a browser typography inspector. You inject it onto any page, click text elements, drag sliders to adjust their type, and copy the CSS. The MCP server closes the loop: instead of pasting CSS into a chat, the agent sees your changes automatically and writes them to the file.

## How it works

```
Browser (TypeSet overlay)
  │  user drags slider, clicks Copy
  │
  ▼
HTTP POST localhost:8800/commit
  │  { selector, property, value, previousValue }
  │
  ▼
MCP Server (typeset-mcp)
  │  queues the change, notifies the agent
  │
  ▼
Agent (Claude Code)
  │  reads pending changes via MCP tools
  │  finds the file, shows the diff, asks to apply
  │
  ▼
CSS file updated
```

The overlay and the MCP server are independent. The overlay works without the server (Copy still goes to clipboard). The server works without the overlay (you can POST changes manually).

## Architecture

The MCP server runs two transports simultaneously:

1. **stdio** for the MCP protocol. Claude Code connects to this. The server exposes tools and a resource.
2. **HTTP on :8800** for the browser. TypeSet POSTs committed changes here. CORS-enabled, localhost only.

### What the overlay sends

When you click Copy CSS, TypeSet sends one object per changed property:

```json
[
  { "selector": "h1", "property": "font-size", "value": "48px", "previousValue": "72px" },
  { "selector": "h1", "property": "font-weight", "value": "700", "previousValue": "400" }
]
```

The selector comes from TypeSet's `cssSelector()` function: `#id` if the element has one, otherwise `tag.class1.class2` (up to two classes, excluding internal `typeset-` prefixed ones), with `:nth-of-type(N)` appended for ambiguous siblings.

**CSS lookup note:** The selector sent to the agent (e.g. `h1.display`) may be more specific than the actual CSS rule (e.g. `.display`). When searching, try the full selector first, then fall back to searching by class name. Also note that styles may live in `<style>` blocks inside HTML files rather than standalone `.css` files.

### What the agent sees

**Resource:** `typeset://pending-changes` fires `resources/updated` when new changes arrive.

**Tools:**

| Tool | Purpose |
|------|---------|
| `get_pending_changes` | List all queued changes with IDs |
| `apply_typeset_change(changeId)` | Mark a change as applied |
| `reject_typeset_change(changeId)` | Discard a change the agent can't apply |

### Stateful queue

The server holds a queue of pending changes keyed by auto-incrementing ID. This handles the case where the user commits three changes while the agent is still processing the first. The agent works through them in order, calling `apply_typeset_change` after each file write.

## Setup

### For development (this repo)

The MCP server lives in `mcp-server/`. To test locally:

```bash
# Terminal 1: start the MCP server
cd mcp-server && node index.js

# Terminal 2: start the dev server
npx vite

# Browser: open http://127.0.0.1:5173/index.html
# Make edits, click Copy, then check:
curl http://127.0.0.1:8800/health
```

To connect it to Claude Code, register the local build with `claude mcp add` (Claude Code reads MCP servers from `~/.claude.json`, **not** from `settings.json`):

```bash
claude mcp add typeset --scope user -- node /path/to/typeset/mcp-server/index.js
```

Verify with `claude mcp list` — `typeset` should show `✔ Connected`. Start a new session and the `mcp__typeset__*` tools appear.

### For distribution (npm)

Published as `typeset-mcp` on npm. Users run one command:

```bash
npx typeset-mcp install
```

This installs the HTTP daemon (launchd, port 8800), registers the MCP server with Claude Code via `claude mcp add --scope user` (writing `~/.claude.json`), and adds the agent instructions to `~/.claude/CLAUDE.md`. No git clone, no manual config.

> **Do not hand-write the server into `settings.json`.** Claude Code does not load MCP server *definitions* from `~/.claude/settings.json` (or a workspace `.claude/settings.json`) — they are silently ignored and the tools never appear. Definitions live in `~/.claude.json` (via `claude mcp add`) or a project `.mcp.json`; `settings.json` only holds MCP *controls* (`enableAllProjectMcpServers`, `enabledMcpjsonServers`).

Manual alternative, or to register with other agents (Cursor, Windsurf, Codex — Agentation-style):

```bash
claude mcp add typeset --scope user -- npx -y typeset-mcp
# or, multi-agent auto-detect:
npx add-mcp "npx -y typeset-mcp"
```

The overlay is separate: a single JS file loaded via bookmarklet or script tag. No npm needed.

### Publishing checklist

1. Update `mcp-server/package.json`: set `name` to `typeset-mcp`, add `description`, `repository`, `license`, `keywords`
2. Add `#!/usr/bin/env node` to `index.js` (already present)
3. `npm publish` from `mcp-server/`
4. Enable GitHub Pages on the repo so the bookmarklet URL resolves
5. Update README with the two install paths

## The approval flow

From the user's perspective:

1. Open a page in the browser with TypeSet injected
2. Select a text element, drag sliders until it looks right
3. Click Copy (clipboard icon in the toolbar)
4. In the agent's chat, a message appears: "TypeSet change: `h1 { font-size: 72px -> 48px }`. Found in `src/styles.css` line 14. Apply?"
5. User says yes. Agent writes the file.

Step 4 happens because the MCP server notified the agent via `resources/updated`, and the agent called `get_pending_changes` to read the queue.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `TYPESET_PORT` | `8800` | HTTP port for the browser endpoint |

## Design decisions

**Why HTTP + stdio, not just stdio?** The browser can't speak stdio. It needs an HTTP endpoint to POST to. The MCP server bridges the two: HTTP in from the browser, stdio out to the agent.

**Why per-property changes, not whole-block CSS?** Per-property changes let the agent do precise find-and-replace in the stylesheet. A whole CSS block would require the agent to parse and diff it. Per-property is also what the agent needs for its approval message: "font-size: 72px to 48px" is actionable; a 10-line CSS block is not.

**Why queue, not fire-and-forget?** The user might commit faster than the agent can process. A queue with IDs ensures nothing is lost and the agent can work through changes in order.

**Why `.catch(() => {})` on the fetch?** The overlay must work without the MCP server running. Silent failure means Copy CSS always works; the MCP integration is additive.
