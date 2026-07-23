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
const WATCHING_FILE = join(homedir(), ".typeset-watching.json");
const WATCH_TTL_MS = 10000;   // a project's watch heartbeat is considered live for this long
const CLAUDE_SETTINGS = join(homedir(), ".claude", "settings.json");
const CLAUDE_MD = join(homedir(), ".claude", "CLAUDE.md");
const CLAUDE_MD_MARKER_START = "<!-- typeset:start -->";
const CLAUDE_MD_MARKER_END = "<!-- typeset:end -->";
const CLAUDE_MD_SECTION = `
${CLAUDE_MD_MARKER_START}
## TypeSet — Live Typography Editing

TypeSet routes each browser edit to the chat that owns its project, keyed on the project's absolute path, so you can iterate across many pages and workspaces at once without them colliding. Tools: \`get_pending_changes\`, \`apply_typeset_change\`, \`reject_typeset_change\`, \`set_typeset_project\`, \`watch_typeset_changes\`.

**Bind this chat to its workspace — do this once, as early as you touch TypeSet in a session:** run \`pwd\`, then call \`set_typeset_project\` with that path. This chat now only receives edits from that workspace. You do NOT need the user to say "add typeset"; bind on your own the first time TypeSet is relevant.

**Ensure the overlay tag is on the page — this is what makes the panel appear.** When you spin up or open a frontend project, make sure its HTML carries the overlay script tag with \`data-project\` set to this session's \`pwd\`: add the tag if missing, or add the attribute if an older tag lacks it. This both makes the panel show up and routes the page's edits to this chat. The tag persists in the HTML and self-disables on production hosts, so it is safe to leave in (remove it if you prefer):
\`\`\`html
<script src="https://32lngs-js.github.io/typeset/typeset-overlay.js" data-project="<pwd>"></script>
\`\`\`

**Applying an edit:** each change is a selector, a property, and a target \`value\`; make that property equal \`value\` in the SOURCE. Locate it: for normal CSS, search the class portion of the selector (e.g. \`h1.display\` → \`.display\`) in \`<style>\` blocks and \`.css\` files; for Tailwind the value lives in a utility class ON the element and the selector contains it — a selector with \`text-[30px]\` means \`class="... text-[30px] ..."\`, so change that class to e.g. \`text-[20.5px]\`. Decide whether to write by reading the source: if it already holds \`value\`, skip; otherwise write \`value\`. Do NOT judge this from any before/after numbers (TypeSet reports the browser's computed state, which does not reflect the source and often already equals the target). Only call \`apply_typeset_change\` once the file actually holds \`value\`.

**Watch mode (hands-free): enter it on your own; never make the user type "watch mode".** The trigger is the START of a design session, not the first edit. The moment you spin up or start a dev server for, or open, a frontend project's page, first ensure the overlay tag is present (see above — add it if missing so the panel appears), then immediately bind (\`pwd\` → \`set_typeset_project\`) and call \`watch_typeset_changes\` in a loop. Do NOT finish that turn and go idle: the user is about to scrub, and once you are idle a browser action (like clicking the overlay's watch toggle) cannot restart you. The loop: it blocks until edits arrive (returns immediately if some are pending), returns a batch, apply each (see above), then call \`watch_typeset_changes\` again. Each call blocks ~25s and yields, so if the user sends a message meanwhile, handle it and resume watching if they are still designing. Keep looping until they say stop or switch tasks. A "no edits yet" return or a connection close is normal; just call it again. If the user pastes **"watch my TypeSet edits"** — the overlay shows this exact phrase as the pairing cue when no agent is watching (typically after you had gone idle) — treat it as an explicit request to (re)enter the \`watch_typeset_changes\` loop right away.
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

// Heartbeat: record that this session is actively watching its project, so the daemon can tell the
// overlay whether an agent is listening (the agent-watching indicator). Keyed by project path, or
// "*" when unbound (single-session fallback). Expired entries are pruned on each write.
function beat() {
  try {
    let obj = {};
    try { obj = JSON.parse(readFileSync(WATCHING_FILE, "utf8")); } catch {}
    const now = Date.now();
    for (const k of Object.keys(obj)) if (!(obj[k] > now)) delete obj[k];
    obj[scopedProject || "*"] = now + WATCH_TTL_MS;
    writeFileSync(WATCHING_FILE, JSON.stringify(obj));
  } catch {}
}

// The project this session is bound to (via set_typeset_project, or the TYPESET_PROJECT env).
// When set, the session only surfaces/reacts to changes tagged with this project, so parallel
// workspaces don't fight over the same overlay commits. Null means see everything (backward compat).
let scopedProject = process.env.TYPESET_PROJECT || null;

function pendingForSession() {
  const all = readPending();
  return scopedProject ? all.filter(c => c.project === scopedProject) : all;
}

function summarize(changes) {
  // Show only the TARGET value. previousValue is the browser's computed state, not the
  // source file value, so a "from → to" display is misleading (often reads as a no-op).
  return changes.map(c =>
    `[${c.id}] ${c.selector} { ${c.property}: ${c.value}; }${c.project ? `  (project: ${c.project})` : ""}`
  ).join("\n");
}

const mcp = new McpServer({ name: "typeset", version: "0.1.18" });

mcp.resource(
  "pending-changes",
  "typeset://pending-changes",
  { description: "CSS changes committed from the TypeSet overlay, waiting for agent application" },
  async () => ({
    contents: [{
      uri: "typeset://pending-changes",
      mimeType: "application/json",
      text: JSON.stringify(pendingForSession(), null, 2),
    }],
  })
);

mcp.tool(
  "get_pending_changes",
  "List all CSS changes committed from the TypeSet browser overlay that haven't been applied yet. Each change has a selector (e.g. 'h1.display'), property, and value. To locate the CSS rule: (1) search by the class portion of the selector — e.g. for 'h1.display' search for '.display' — since rules often use class-only selectors; (2) check <style> blocks inside HTML files as well as .css files. Fallback when MCP tools are unavailable: read ~/.typeset-pending.json, or GET http://127.0.0.1:8800/changes.",
  {},
  async () => {
    const changes = pendingForSession();
    if (!changes.length) return { content: [{ type: "text", text: "No pending changes." }] };
    return { content: [{ type: "text", text: summarize(changes) }] };
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

mcp.tool(
  "set_typeset_project",
  "Bind this session to a project so it only receives TypeSet changes from that project's page. Call this when you add the TypeSet overlay to a page, passing the same absolute path you set as the overlay's data-project attribute (usually your working directory). Pass an empty string to unbind and see all changes again.",
  { project: z.string().describe("Absolute project path to bind to (must match the overlay's data-project); empty string to unbind") },
  async ({ project }) => {
    scopedProject = project && project.trim() ? project.trim() : null;
    if (!scopedProject) return { content: [{ type: "text", text: "Unbound. This session now sees all pending TypeSet changes." }] };
    const n = pendingForSession().length;
    return { content: [{ type: "text", text: `Bound to project: ${scopedProject} (${n} pending change${n === 1 ? "" : "s"} for this session).` }] };
  }
);

mcp.tool(
  "watch_typeset_changes",
  "Hands-free mode: block until TypeSet edits are available for this session, then return them as a batch (returns immediately if edits are already pending). Call this in a loop — apply each returned change (write the file, then call apply_typeset_change), then call watch_typeset_changes again — so the user can scrub in the browser and see edits applied live without re-prompting. On timeout it returns a 'no edits yet' note; just call it again to keep watching. Stop when the user says so.",
  { timeoutSeconds: z.number().optional().describe("Max seconds to block before returning empty (default 25; kept under the MCP client's tool-call timeout, so loop).") },
  async ({ timeoutSeconds }) => {
    const timeoutMs = Math.max(1, Math.min(timeoutSeconds || 25, 55)) * 1000;
    beat();   // mark this session as watching its project
    return await new Promise((resolve) => {
      let done = false;
      const finish = (text) => {
        if (done) return;
        done = true;
        try { watcher.close(); } catch {}
        clearInterval(poll);
        clearTimeout(timer);
        resolve({ content: [{ type: "text", text }] });
      };
      const check = () => {
        const changes = pendingForSession();
        if (changes.length) finish(summarize(changes));
      };
      const watcher = watch(homedir(), { persistent: false }, (_, f) => { if (f === ".typeset-pending.json") check(); });
      const poll = setInterval(() => { beat(); check(); }, 1000);   // keep the heartbeat fresh while blocking
      const timer = setTimeout(() => finish("No new TypeSet edits within the timeout. Call watch_typeset_changes again to keep watching, or stop if the user is done."), timeoutMs);
      check();
    });
  }
);

const transport = new StdioServerTransport();
const server = await mcp.connect(transport);

watch(homedir(), { persistent: false }, (_, filename) => {
  if (filename !== ".typeset-pending.json") return;
  // Only wake this session if the change concerns its bound project (or it's unbound).
  if (scopedProject && !readPending().some(c => c.project === scopedProject)) return;
  server.notification({ method: "notifications/resources/updated", params: { uri: "typeset://pending-changes" } });
});

// --- install / uninstall helpers ---
function plistPath() {
  return join(homedir(), "Library", "LaunchAgents", "com.typeset.server.plist");
}

function addToClaudeMd() {
  let content = existsSync(CLAUDE_MD) ? readFileSync(CLAUDE_MD, "utf8") : "";
  const section = CLAUDE_MD_SECTION.trim();
  const start = content.indexOf(CLAUDE_MD_MARKER_START);
  const end = content.indexOf(CLAUDE_MD_MARKER_END);
  if (start !== -1 && end !== -1) {
    // Replace the existing section in place so instruction updates propagate on reinstall.
    content = content.slice(0, start) + section + content.slice(end + CLAUDE_MD_MARKER_END.length);
  } else {
    content = content.trim() ? content.trimEnd() + "\n\n" + section + "\n" : section + "\n";
  }
  writeFileSync(CLAUDE_MD, content);
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
