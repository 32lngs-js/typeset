#!/usr/bin/env node
import { createServer } from "http";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { execSync } from "child_process";

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

function readChanges() {
  try { return JSON.parse(readFileSync(PENDING_FILE, "utf8")); } catch { return []; }
}

function writeChanges(changes) {
  writeFileSync(PENDING_FILE, JSON.stringify(changes, null, 2));
}

// --- CLI ---
const cmd = process.argv[2];
if (cmd === "install") { installLaunchd(); process.exit(0); }
if (cmd === "uninstall") { uninstallLaunchd(); process.exit(0); }

// --- HTTP server ---
let changeId = Math.max(0, ...readChanges().map(c => c.id));

const httpServer = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.method === "POST" && req.url === "/commit") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const incoming = JSON.parse(body);
        const changes = readChanges();
        const committed = [];
        for (const c of Array.isArray(incoming) ? incoming : [incoming]) {
          const id = ++changeId;
          changes.push({ id, selector: c.selector, property: c.property, value: c.value, previousValue: c.previousValue || null, timestamp: Date.now() });
          committed.push(id);
        }
        writeChanges(changes);
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
    res.end(JSON.stringify(readChanges(), null, 2));
    return;
  }

  // DELETE /changes/:id — mark a change as applied (fallback when MCP tools unavailable)
  const applyMatch = req.url?.match(/^\/changes\/(\d+)$/);
  if (req.method === "DELETE" && applyMatch) {
    const id = parseInt(applyMatch[1]);
    const changes = readChanges();
    const change = changes.find(c => c.id === id);
    if (!change) { res.writeHead(404); res.end(JSON.stringify({ error: "not found" })); return; }
    writeChanges(changes.filter(c => c.id !== id));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, applied: change }));
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, pending: readChanges().length, port: PORT }));
    return;
  }

  res.writeHead(404); res.end("Not found");
});

httpServer.on("error", err => {
  if (err.code === "EADDRINUSE") {
    process.stderr.write(`TypeSet Server: port ${PORT} already in use. Run \`npx typeset-server uninstall\` then reinstall, or set TYPESET_PORT.\n`);
    process.exit(1);
  }
  throw err;
});

httpServer.listen(PORT, "127.0.0.1", () => {
  process.stderr.write(`TypeSet Server: listening on http://127.0.0.1:${PORT}\n`);
});

// --- launchd + settings.json ---
function plistPath() {
  return join(homedir(), "Library", "LaunchAgents", "com.typeset.server.plist");
}

function addToClaudeMd() {
  let content = "";
  if (existsSync(CLAUDE_MD)) {
    content = readFileSync(CLAUDE_MD, "utf8");
  }
  if (content.includes(CLAUDE_MD_MARKER_START)) return; // already present
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

function addToClaudeSettings() {
  let settings = {};
  if (existsSync(CLAUDE_SETTINGS)) {
    try { settings = JSON.parse(readFileSync(CLAUDE_SETTINGS, "utf8")); } catch {}
  }
  if (!settings.mcpServers) settings.mcpServers = {};
  settings.mcpServers.typeset = {
    command: "npx",
    args: ["-y", "typeset-mcp"],
    env: { PATH: "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin" },
  };
  writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2));
}

function installLaunchd() {
  const nodePath = process.execPath;
  const serverPath = new URL(import.meta.url).pathname;
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

  addToClaudeSettings();
  addToClaudeMd();

  process.stdout.write(`TypeSet installed.\n`);
  process.stdout.write(`  Daemon  : running on http://127.0.0.1:${PORT}, starts on login\n`);
  process.stdout.write(`  Logs    : /tmp/typeset-server.log\n`);
  process.stdout.write(`  MCP     : added typeset-mcp to ~/.claude/settings.json\n`);
  process.stdout.write(`  Agent   : added TypeSet instructions to ~/.claude/CLAUDE.md\n`);
  process.stdout.write(`\nOpen a new Claude Code session — the TypeSet tools will be ready.\n`);
}

function uninstallLaunchd() {
  const path = plistPath();
  try { execSync(`launchctl unload "${path}"`); } catch {}
  try { execSync(`rm "${path}"`); } catch {}

  // Remove from settings.json
  if (existsSync(CLAUDE_SETTINGS)) {
    try {
      const settings = JSON.parse(readFileSync(CLAUDE_SETTINGS, "utf8"));
      if (settings.mcpServers?.typeset) {
        delete settings.mcpServers.typeset;
        writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2));
      }
    } catch {}
  }

  removeFromClaudeMd();
  process.stdout.write(`TypeSet uninstalled.\n`);
}
