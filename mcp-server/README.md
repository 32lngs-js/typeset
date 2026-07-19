# typeset-mcp

MCP server that bridges the [TypeSet](https://github.com/32lngs-js/typeset) browser overlay to coding agents. When you edit typography in the browser and click Copy, changes flow directly to the agent, which writes them to your CSS file.

## Setup

Two commands, both one-time:

**1. Start the background server** (run once per project, survives reboots):

```sh
cd your-project
npx typeset-server install
```

This installs a launchd daemon that listens for browser POSTs on port 8800 and persists changes to `.typeset-pending.json`. Starts now and on every login.

**2. Add the MCP tools** to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "typeset": {
      "command": "npx",
      "args": ["-y", "typeset-mcp"],
      "env": {
        "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
      }
    }
  }
}
```

That's it. The `typeset-mcp` tools will appear in every agent session.

## How it works

```
Browser overlay  →  POST :8800  →  typeset-server (daemon)  →  .typeset-pending.json
                                                                         ↑
                                    Claude (any session)  ←  typeset-mcp (reads file)
```

- **`typeset-server`** is a persistent daemon — one per project, always on. Accepts browser POSTs, writes changes to `.typeset-pending.json`, survives session restarts.
- **`typeset-mcp`** is a pure stdio MCP server — one per agent session. Reads changes from the file, notifies the agent via `fs.watch`, applies/rejects via file edits.

## Workflow

1. Inject TypeSet onto any page and edit typography with sliders
2. Click Copy — the overlay POSTs changes to `localhost:8800/commit`
3. The agent is notified via `notifications/resources/updated`
4. The agent calls `get_pending_changes`, locates the CSS rule, and applies the edit
5. The agent calls `apply_typeset_change` to mark it done

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
