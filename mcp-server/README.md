# typeset-mcp

MCP server that bridges the [TypeSet](https://github.com/32lngs-js/typeset) browser overlay to coding agents. When you edit typography in the browser and click Copy, changes flow directly to the agent, which writes them to your CSS file.

## Setup

Add to your Claude Code settings (`.claude/settings.json`):

```json
{
  "mcpServers": {
    "typeset": {
      "command": "npx",
      "args": ["typeset-mcp"]
    }
  }
}
```

That's it. The server starts automatically when your agent session begins.

## How it works

```
Browser (TypeSet overlay)  →  HTTP POST :8800  →  MCP Server  →  Agent reads & applies
```

1. You inject TypeSet onto any page and edit typography with sliders
2. Click Copy — the overlay POSTs changes to `localhost:8800/commit`
3. The MCP server queues them and notifies the agent
4. The agent calls `get_pending_changes`, locates the CSS file, and applies the edit

## Tools

| Tool | Description |
|------|-------------|
| `get_pending_changes` | List queued CSS changes with IDs |
| `apply_typeset_change` | Mark a change as applied after writing to file |
| `reject_typeset_change` | Discard a change the agent can't apply |

## Resource

`typeset://pending-changes` — JSON array of all pending changes. Fires `notifications/resources/updated` when new changes arrive.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `TYPESET_PORT` | `8800` | HTTP port for browser endpoint |

## License

MIT
