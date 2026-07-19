# typeset-mcp

MCP server that bridges the [TypeSet](https://github.com/32lngs-js/typeset) browser overlay to coding agents. When you edit typography in the browser and click Copy, changes flow directly to the agent, which writes them to your CSS file.

## Setup

One command, run once ever:

```sh
npx typeset-server install
```

This starts a background daemon (port 8800, survives reboots) and automatically adds `typeset-mcp` to `~/.claude/settings.json`. Open a new Claude Code session and the tools are ready — no per-project setup.

## How it works

```
Browser overlay  →  POST :8800  →  typeset-server (daemon)  →  .typeset-pending.json
                                                                         ↑
                                    Claude (any session)  ←  typeset-mcp (reads file)
```

- **`typeset-server`** is a persistent daemon — one per project, always on. Accepts browser POSTs, writes changes to `.typeset-pending.json`, survives session restarts.
- **`typeset-mcp`** is a pure stdio MCP server — one per agent session. Reads changes from the file, notifies the agent via `fs.watch`, applies/rejects via file edits.

## Workflow

**Step 1 — Add TypeSet to your dev HTML** (remove before shipping):

```html
<script src="https://32lngs-js.github.io/typeset/typeset-overlay.js"></script>
```

The panel appears automatically whenever your dev server is running. No bookmarklet, no extension.

**Step 2 — Edit and commit:**

1. Click any text element on your page
2. Scrub sliders to adjust typography
3. Click **Copy** — changes POST to `localhost:8800` and queue for the agent

**Step 3 — Agent applies the change:**

1. Agent is notified via `notifications/resources/updated`
2. Agent calls `get_pending_changes`, locates the CSS rule in your project
3. Agent edits the file and calls `apply_typeset_change` to mark it done

## MCP Tools

| Tool | Description |
|------|-------------|
| `get_pending_changes` | List queued CSS changes with IDs, selectors, and values |
| `apply_typeset_change` | Mark a change as applied after writing to file |
| `reject_typeset_change` | Discard a change the agent can't apply |

## HTTP API (fallback)

If MCP tools aren't available, the daemon's HTTP API covers the full workflow:

| Endpoint | Description |
|----------|-------------|
| `GET /changes` | List pending changes |
| `POST /commit` | Submit changes from browser (used by overlay) |
| `DELETE /changes/:id` | Mark a change as applied |
| `GET /health` | Server status and pending count |

## Server management

```sh
npx typeset-server install    # Install launchd daemon, start now
npx typeset-server uninstall  # Stop and remove daemon
```

Logs: `/tmp/typeset-server.log`

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `TYPESET_PORT` | `8800` | HTTP port for browser endpoint |

## License

MIT
