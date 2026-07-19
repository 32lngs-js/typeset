#!/usr/bin/env node
import { createServer } from "http";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { execSync } from "child_process";

const PORT = parseInt(process.env.TYPESET_PORT || "8800");
const PENDING_FILE = join(process.cwd(), ".typeset-pending.json");

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
    res.end(JSON.stringify({ ok: true, pending: readChanges().length, cwd: process.cwd(), port: PORT }));
    return;
  }

  res.writeHead(404); res.end("Not found");
});

httpServer.on("error", err => {
  if (err.code === "EADDRINUSE") {
    process.stderr.write(`TypeSet Server: port ${PORT} already in use. Run \`typeset-server uninstall\` then reinstall, or set TYPESET_PORT.\n`);
    process.exit(1);
  }
  throw err;
});

httpServer.listen(PORT, "127.0.0.1", () => {
  process.stderr.write(`TypeSet Server: listening on http://127.0.0.1:${PORT}\n`);
  process.stderr.write(`TypeSet Server: project root = ${process.cwd()}\n`);
});

// --- launchd ---
function plistPath() {
  return join(homedir(), "Library", "LaunchAgents", "com.typeset.server.plist");
}

function installLaunchd() {
  const projectRoot = process.cwd();
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
  <key>WorkingDirectory</key>
  <string>${projectRoot}</string>
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
  process.stdout.write(`TypeSet Server installed as launchd agent\n`);
  process.stdout.write(`  Project root : ${projectRoot}\n`);
  process.stdout.write(`  Port         : ${PORT}\n`);
  process.stdout.write(`  Logs         : /tmp/typeset-server.log\n`);
  process.stdout.write(`  Plist        : ${path}\n`);
  process.stdout.write(`Starts automatically on login. Running now.\n`);
}

function uninstallLaunchd() {
  const path = plistPath();
  try { execSync(`launchctl unload "${path}"`); } catch {}
  try { execSync(`rm "${path}"`); } catch {}
  process.stdout.write(`TypeSet Server uninstalled.\n`);
}
