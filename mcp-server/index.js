#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync, writeFileSync, watch } from "fs";
import { join } from "path";
import { homedir } from "os";
import { z } from "zod";

const PENDING_FILE = join(homedir(), ".typeset-pending.json");

function readPending() {
  try { return JSON.parse(readFileSync(PENDING_FILE, "utf8")); } catch { return []; }
}

function writePending(changes) {
  writeFileSync(PENDING_FILE, JSON.stringify(changes, null, 2));
}

const mcp = new McpServer({ name: "typeset", version: "0.1.5" });

mcp.resource(
  "pending-changes",
  "typeset://pending-changes",
  { description: "CSS changes committed from the TypeSet overlay, waiting for agent application" },
  async () => ({
    contents: [{
      uri: "typeset://pending-changes",
      mimeType: "application/json",
      text: JSON.stringify(readPending(), null, 2),
    }],
  })
);

mcp.tool(
  "get_pending_changes",
  "List all CSS changes committed from the TypeSet browser overlay that haven't been applied yet. Each change has a selector (e.g. 'h1.display'), property, and value. To locate the CSS rule: (1) search by the class portion of the selector — e.g. for 'h1.display' search for '.display' — since rules often use class-only selectors; (2) check <style> blocks inside HTML files as well as .css files. Fallback when MCP tools are unavailable: read ~/.typeset-pending.json, or GET http://127.0.0.1:8800/changes.",
  {},
  async () => {
    const changes = readPending();
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
    const changes = readPending();
    const change = changes.find(c => c.id === id);
    if (!change) return { content: [{ type: "text", text: `Change ${id} not found (already applied or rejected).` }] };
    writePending(changes.filter(c => c.id !== id));
    return { content: [{ type: "text", text: `Applied: ${change.selector} { ${change.property}: ${change.value}; }` }] };
  }
);

mcp.tool(
  "reject_typeset_change",
  "Reject a TypeSet change (agent couldn't find the selector or user said no)",
  { changeId: z.number().describe("The change ID to reject") },
  async ({ changeId: id }) => {
    const changes = readPending();
    const change = changes.find(c => c.id === id);
    if (!change) return { content: [{ type: "text", text: `Change ${id} not found.` }] };
    writePending(changes.filter(c => c.id !== id));
    return { content: [{ type: "text", text: `Rejected: ${change.selector} { ${change.property}: ${change.value}; }` }] };
  }
);

const transport = new StdioServerTransport();
const server = await mcp.connect(transport);

// Notify agent when typeset-server writes new changes to the global pending file
watch(homedir(), { persistent: false }, (_, filename) => {
  if (filename === ".typeset-pending.json") {
    server.notification({ method: "notifications/resources/updated", params: { uri: "typeset://pending-changes" } });
  }
});
