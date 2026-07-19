#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync, writeFileSync, existsSync, watch } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { execSync } from "child_process";
import { z } from "zod";

const PORT = parseInt(process.env.TYPESET_PORT || "8800");
const PENDING_FILE = join(homedir(), ".typeset-pending.json");
const CLAUDE_SETTINGS = join(homedir(), ".claude", "settings.json");
const CLAUDE_MD = join(homedir(), ".claude", "CLAUDE.md");
const CLAUDE_MD_MARKER_START = "<!-- typeset:start -->";
const CLAUDE_MD_MARKER_END = "<!-- typeset:end -->";
const CLAUDE_MD_SECTION = `
${CLAUDE_MD_MARKER_START}
## TypeSet — Live Typography Editing

TypeSet MCP tools are installed (\`get_pending_changes\`, \`apply_typeset_change\`, \`reject_typeset_change\`).

**When starting any frontend project:** ensure this script tag is in the HTML (remove before shipping):
\`\`\`html
<script src="https://32lngs-js.github.io/typeset/typeset-overlay.js"></script>
\`\`\`

**When \`notifications/resources/updated\` fires from typeset:** immediately call \`get_pending_changes\`. For each pending change, find the CSS rule by searching for the class portion of the selector (e.g. \`h1.display\` → search for \`.display\`) in \`<style>\` blocks and \`.css\` files. Write the new value, then call \`apply_typeset_change\` with the change ID.
${CLAUDE_MD_MARKER_END}`;

// --- CLI (install / uninstall) ---
const cmd = process.argv[2];
if (cmd === "install") { doInstall(); process.exit(0); }
if (cmd === "uninstall") { doUninstall(); process.exit(0); }

// --- MCP stdio server ---
function readPending() {
  try { return JSON.parse(readFileSync(PENDING_FILE, "utf8")); } catch { return []; }
}

function writePending(changes) {
  writeFileSync(PENDING_FILE, JSON.stringify(changes, null, 2));
}

const mcp = new McpServer({ name: "typeset", version: "0.1.8" });

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

watch(homedir(), { persistent: false }, (_, filename) => {
  if (filename === ".typeset-pending.json") {
    server.notification({ method: "notifications/resources/updated", params: { uri: "typeset://pending-changes" } });
  }
});

// --- install / uninstall helpers ---
function plistPath() {
  return join(homedir(), "Library", "LaunchAgents", "com.typeset.server.plist");
}

function addToClaudeMd() {
  let content = existsSync(CLAUDE_MD) ? readFileSync(CLAUDE_MD, "utf8") : "";
  if (content.includes(CLAUDE_MD_MARKER_START)) return;
  writeFileSync(CLAUDE_MD, content + "\n" + CLAUDE_MD_SECTION + "\n");
}

function removeFromClaudeMd() {
  if (!existsSync(CLAUDE_MD)) return;
  const content = readFileSync(CLAUDE_MD, "utf8");
  const start = content.indexOf(CLAUDE_MD_MARKER_START);
  const end = content.indexOf(CLAUDE_MD_MARKER_END);
  if (start === -1 || end === -1) return;
  const cleaned = content.slice(0, start).trimEnd() + "\n" + content.slice(end + CLAUDE_MD_MARKER_END.length).trimStart();
  writeFileSync(CLAUDE_MD, cleaned);
}

// Register the MCP server where Claude Code actually reads server definitions:
// ~/.claude.json (user scope), via `claude mcp add`. Claude Code does NOT load MCP
// servers from settings.json, so writing there is silently ignored. Idempotent —
// remove any prior entry first, then add. Returns true on success.
function registerMcpServer() {
  try {
    try { execSync("claude mcp remove typeset --scope user", { stdio: "ignore" }); } catch {}
    execSync("claude mcp add typeset --scope user -- npx -y typeset-mcp", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// Migration: versions <= 0.1.7 wrongly wrote the server into settings.json, which
// Claude Code ignores. Strip any such stale entry so it can't cause confusion.
function removeLegacyClaudeSettings() {
  if (!existsSync(CLAUDE_SETTINGS)) return;
  try {
    const settings = JSON.parse(readFileSync(CLAUDE_SETTINGS, "utf8"));
    if (settings.mcpServers && settings.mcpServers.typeset) {
      delete settings.mcpServers.typeset;
      if (Object.keys(settings.mcpServers).length === 0) delete settings.mcpServers;
      writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2));
    }
  } catch {}
}

function doInstall() {
  const nodePath = process.execPath;
  const serverPath = join(dirname(new URL(import.meta.url).pathname), "server.js");
  const path = plistPath();

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.typeset.server</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${serverPath}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardErrorPath</key>
  <string>/tmp/typeset-server.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>TYPESET_PORT</key>
    <string>${PORT}</string>
  </dict>
</dict>
</plist>`;

  writeFileSync(path, plist);
  try { execSync(`launchctl unload "${path}" 2>/dev/null`); } catch {}
  execSync(`launchctl load "${path}"`);

  const registered = registerMcpServer();
  removeLegacyClaudeSettings();
  addToClaudeMd();

  process.stdout.write(`TypeSet installed.\n`);
  process.stdout.write(`  Daemon  : running on http://127.0.0.1:${PORT}, starts on login\n`);
  process.stdout.write(`  Logs    : /tmp/typeset-server.log\n`);
  if (registered) {
    process.stdout.write(`  MCP     : registered 'typeset' with Claude Code (~/.claude.json, user scope)\n`);
  } else {
    process.stdout.write(`  MCP     : could not run 'claude mcp add' — register it manually:\n`);
    process.stdout.write(`              claude mcp add typeset --scope user -- npx -y typeset-mcp\n`);
  }
  process.stdout.write(`  Agent   : added TypeSet instructions to ~/.claude/CLAUDE.md\n`);
  process.stdout.write(`\nOpen a new Claude Code session — the TypeSet tools will be ready.\n`);
}

function doUninstall() {
  const path = plistPath();
  try { execSync(`launchctl unload "${path}"`); } catch {}
  try { execSync(`rm "${path}"`); } catch {}

  try { execSync("claude mcp remove typeset --scope user", { stdio: "ignore" }); } catch {}
  removeLegacyClaudeSettings();

  removeFromClaudeMd();
  process.stdout.write(`TypeSet uninstalled.\n`);
}
