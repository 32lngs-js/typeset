#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "http";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { z } from "zod";

const PORT = parseInt(process.env.TYPESET_PORT || "8800");
const PENDING_FILE = join(process.cwd(), ".typeset-pending.json");

let changeId = 0;
const pending = new Map();
let server;

try {
  const saved = JSON.parse(readFileSync(PENDING_FILE, "utf8"));
  for (const c of saved) {
    pending.set(c.id, c);
    if (c.id >= changeId) changeId = c.id;
  }
  if (pending.size) process.stderr.write(`TypeSet MCP: loaded ${pending.size} pending change(s) from ${PENDING_FILE}\n`);
} catch (e) {
  // File missing or unreadable — start fresh
}

function savePending() {
  try {
    writeFileSync(PENDING_FILE, JSON.stringify([...pending.values()], null, 2));
  } catch (e) {
    process.stderr.write(`TypeSet MCP: failed to write ${PENDING_FILE}: ${e.message}\n`);
  }
}

const mcp = new McpServer({
  name: "typeset",
  version: "0.1.3",
});

mcp.resource(
  "pending-changes",
  "typeset://pending-changes",
  { description: "CSS changes committed from the TypeSet overlay, waiting for agent application" },
  async () => ({
    contents: [{
      uri: "typeset://pending-changes",
      mimeType: "application/json",
      text: JSON.stringify([...pending.values()], null, 2),
    }],
  })
);

mcp.tool(
  "get_pending_changes",
  "List all CSS changes committed from the TypeSet browser overlay that haven't been applied yet. Each change has a selector (e.g. 'h1.display'), property, and value. To locate the CSS rule: (1) search by the class portion of the selector — e.g. for 'h1.display' search for '.display' — since rules often use class-only selectors; (2) check <style> blocks inside HTML files as well as .css files. Fallback when MCP tools are unavailable: read .typeset-pending.json in the project root, or GET http://127.0.0.1:8800/changes.",
  {},
  async () => {
    const changes = [...pending.values()];
    if (!changes.length) return { content: [{ type: "text", text: "No pending changes." }] };
    const summary = changes.map(c =>
      `[${c.id}] ${c.selector} { ${c.property}: ${c.previousValue} → ${c.value}; }`
    ).join("\n");
    return { content: [{ type: "text", text: summary }] };
  }
);

mcp.tool(
  "apply_typeset_change",
  "Mark a TypeSet change as applied after the agent has written it to the file",
  { changeId: z.number().describe("The change ID to mark as applied") },
  async ({ changeId: id }) => {
    const change = pending.get(id);
    if (!change) return { content: [{ type: "text", text: `Change ${id} not found (already applied or rejected).` }] };
    pending.delete(id);
    savePending();
    return { content: [{ type: "text", text: `Applied: ${change.selector} { ${change.property}: ${change.value}; }` }] };
  }
);

mcp.tool(
  "reject_typeset_change",
  "Reject a TypeSet change (agent couldn't find the selector or user said no)",
  { changeId: z.number().describe("The change ID to reject") },
  async ({ changeId: id }) => {
    const change = pending.get(id);
    if (!change) return { content: [{ type: "text", text: `Change ${id} not found.` }] };
    pending.delete(id);
    savePending();
    return { content: [{ type: "text", text: `Rejected: ${change.selector} { ${change.property}: ${change.value}; }` }] };
  }
);

const httpServer = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.method === "POST" && req.url === "/commit") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const changes = JSON.parse(body);
        const committed = [];
        for (const c of Array.isArray(changes) ? changes : [changes]) {
          const id = ++changeId;
          pending.set(id, { id, selector: c.selector, property: c.property, value: c.value, previousValue: c.previousValue || null, timestamp: Date.now() });
          committed.push(id);
        }
        savePending();
        server?.notification({ method: "notifications/resources/updated", params: { uri: "typeset://pending-changes" } });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, ids: committed }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === "GET" && req.url === "/changes") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify([...pending.values()], null, 2));
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, pending: pending.size }));
    return;
  }

  res.writeHead(404); res.end("Not found");
});

httpServer.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    process.stderr.write(`TypeSet MCP: port ${PORT} already in use — HTTP endpoint disabled. Set TYPESET_PORT to use a different port. MCP tools are still available.\n`);
    // Don't exit — keep the MCP stdio transport alive so tools are accessible.
    return;
  }
  throw err;
});

httpServer.listen(PORT, "127.0.0.1", () => {
  process.stderr.write(`TypeSet MCP: HTTP on http://127.0.0.1:${PORT}\n`);
});

const transport = new StdioServerTransport();
server = await mcp.connect(transport);
