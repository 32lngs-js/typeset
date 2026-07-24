/*
 * TypeSet Overlay — inject the TypeSet typography inspector onto ANY page.
 *
 * Usage:
 *   - Bookmarklet:  javascript:(function(){var s=document.createElement('script');s.src='https://32lngs-js.github.io/typeset/typeset-overlay.js';document.body.appendChild(s);})();
 *   - Console:      paste this whole file into DevTools console on the target page.
 *   - Re-run to toggle it off.
 *
 * It renders inside a Shadow DOM (so the host page's CSS can't touch it and its
 * reset can't touch the host), lets you click any text element on the page to
 * inspect/edit it live, and Copy CSS emits real `selector { ... }` blocks you
 * can paste into that project's stylesheet.
 *
 * Edits are inline styles on the live element — they vanish on reload. Copy CSS
 * is how you persist them. Fonts you pick must be web-loaded or they fall back.
 *
 * Prod-leak guard: when this is loaded via a wired <script data-project="..."> tag
 * (the agent-added dev tag, which persists in the repo), it self-disables on
 * production-like hosts so real visitors never see the overlay. The bookmarklet and
 * console-paste paths carry no data-project and always run, so you can still inspect
 * live sites. Add data-force to the tag to render anyway (LAN/tunnel dev, demos).
 */
(function () {
  'use strict';

  // Prod-leak guard: the wired <script data-project> tag persists in the repo and can ship to
  // production. On a production-like host, self-disable so real visitors never see the overlay.
  // Only the declaratively-wired tag is guarded (identified by data-project, which the agent
  // always sets); the bookmarklet and console-paste paths carry no data-project and are explicit
  // gestures, so they always run — that's how you inspect live sites. Add data-force to render
  // anyway (LAN/tunnel dev, demos).
  const __tsTag = document.currentScript || document.querySelector('script[src*="typeset-overlay"]');
  if (__tsTag && __tsTag.hasAttribute('data-project') && !__tsTag.hasAttribute('data-force')) {
    const h = location.hostname;
    const devHost =
      h === '' || h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' ||
      h === '::1' || h === '[::1]' ||
      h.endsWith('.local') || h.endsWith('.localhost') || h.endsWith('.test') ||
      /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
      /^169\.254\./.test(h);
    if (!devHost) return; // production-like host + wired tag → do not mount
  }

  // Toggle off if already present
  if (window.__typesetOverlay) { window.__typesetOverlay.destroy(); return; }

  const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=DM+Serif+Display:ital@0;1&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400..700;1,400..700&family=Newsreader:ital,opsz,wght@0,6..72,300..800;1,6..72,300..800&family=Space+Grotesk:wght@300..700&family=DM+Sans:wght@300..700&family=Plus+Jakarta+Sans:wght@300..800&family=Geist+Mono:wght@400;500&family=Fragment+Mono&family=Outfit:wght@300..700&display=swap';

  // Load the fonts into the HOST document head (font loading is document-level;
  // shadow DOM can use fonts loaded by the main document).
  if (!document.getElementById('typeset-fonts')) {
    const l = document.createElement('link');
    l.id = 'typeset-fonts'; l.rel = 'stylesheet'; l.href = FONTS_HREF;
    document.head.appendChild(l);
  }

  const CSS = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    #panel {
      --bg:#212121; --bg-hover:rgba(255,255,255,0.1); --border:rgba(255,255,255,0.1);
      --border-sub:rgba(255,255,255,0.06); --text-hi:rgba(255,255,255,0.95);
      --text-mid:rgba(255,255,255,0.7); --text-lo:rgba(255,255,255,0.4); --hint-col:rgba(255,255,255,0.92);
      --text-val:rgba(255,255,255,0.7); --chip-bg:rgba(255,255,255,0.07);
      --chip-bdr:rgba(255,255,255,0.06); --chip-hover:rgba(255,255,255,0.12);
      --sel-bg:rgba(255,255,255,0.05); --sel-bdr:rgba(255,255,255,0.1); --sel-col:rgba(255,255,255,0.7);
      --ab-bg:rgba(255,255,255,0.05); --ab-bdr:rgba(255,255,255,0.1); --ab-col:rgba(255,255,255,0.4);
      --ab-act-bg:rgba(255,255,255,0.11); --ab-act-bdr:rgba(255,255,255,0.15);
      --ring:rgba(255,255,255,0.1); --shadow:rgba(0,0,0,0.5); --icon-col:rgba(255,255,255,0.4);
      --dial-bg:#212121; --dial-icon:rgba(255,255,255,0.95);
      --badge-bg:rgba(255,255,255,0.07); --badge-col:rgba(255,255,255,0.4);
      --sl-track:rgba(255,255,255,0.05); --sl-fill:rgba(255,255,255,0.11); --sl-fill-act:rgba(255,255,255,0.15);
      --sl-hash:rgba(255,255,255,0.15); --sl-handle:rgba(255,255,255,0.95); --radius:8px;
      --accent:#0066ff;
      position:fixed; width:260px; background:var(--bg); border:1px solid var(--border); border-radius:14px;
      box-shadow:0 8px 32px var(--shadow);
      overflow:visible; z-index:2147483647; user-select:none; right:20px; top:20px;
      font-family:system-ui,-apple-system,'SF Pro Display',sans-serif;   /* like DialKit */
      transition:width .42s cubic-bezier(.4,0,.2,1),height .42s cubic-bezier(.4,0,.2,1),
        left .42s cubic-bezier(.4,0,.2,1),top .42s cubic-bezier(.4,0,.2,1),
        border-radius .38s cubic-bezier(.4,0,.2,1),background .2s ease,box-shadow .28s ease;
    }
    #panel.panel-dragging { transition:none; }
    /* While the panel grows in from the dial, clip the (fixed-width) inner content to the
       box so it doesn't spill outside and appear to slide in from the right. Restored to
       overflow:visible on transitionend so dropdowns can escape the box again. */
    #panel.panel-opening { overflow:hidden; }
    .panel-inner { width:260px; opacity:1; transition:opacity .16s ease; padding:10px 12px 0; overflow-y:auto; max-height:calc(100vh - 40px); -ms-overflow-style:none; scrollbar-width:none; }
    /* scroll without a visible bar — same technique as DialKit's .dialkit-panel-inner */
    .panel-inner::-webkit-scrollbar, .font-list::-webkit-scrollbar { display:none; }

    #panel.panel-light {
      --bg:#fafaf9; --bg-hover:rgba(0,0,0,0.08); --border:rgba(0,0,0,0.1); --border-sub:rgba(0,0,0,0.06);
      --text-hi:rgba(0,0,0,0.9); --text-mid:rgba(0,0,0,0.6); --text-lo:rgba(0,0,0,0.35); --text-val:rgba(0,0,0,0.6); --hint-col:rgba(0,0,0,0.88);
      --chip-bg:rgba(0,0,0,0.06); --chip-bdr:rgba(0,0,0,0.06); --chip-hover:rgba(0,0,0,0.1);
      --sel-bg:rgba(0,0,0,0.04); --sel-bdr:rgba(0,0,0,0.1); --sel-col:rgba(0,0,0,0.6);
      --ab-bg:rgba(0,0,0,0.04); --ab-bdr:rgba(0,0,0,0.1); --ab-col:rgba(0,0,0,0.35);
      --ab-act-bg:rgba(0,0,0,0.1); --ab-act-bdr:rgba(0,0,0,0.15); --ring:rgba(0,0,0,0.08); --shadow:rgba(0,0,0,0.08);
      --icon-col:rgba(0,0,0,0.35); --dial-bg:rgba(30,30,30,0.9); --dial-icon:#fff;
      --badge-bg:rgba(0,0,0,0.06); --badge-col:rgba(0,0,0,0.35);
      --sl-track:rgba(0,0,0,0.04); --sl-fill:rgba(0,0,0,0.1); --sl-fill-act:rgba(0,0,0,0.15);
      --sl-hash:rgba(0,0,0,0.15); --sl-handle:rgba(0,0,0,0.9);
    }

    #panel.minimized { background:var(--dial-bg); box-shadow:0 2px 12px rgba(0,0,0,0.22),0 0 0 0.5px rgba(0,0,0,0.08); cursor:grab; overflow:hidden; }
    #panel.minimized:active { cursor:grabbing; }
    #panel.minimized .panel-inner { opacity:0; pointer-events:none; }
    .dial-icon { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      padding-top:1px;
      opacity:0; transition:opacity .14s ease; pointer-events:none; color:var(--dial-icon);
      font-family:'DM Serif Display','Playfair Display',Georgia,serif; font-size:19px; font-weight:400; line-height:1; }
    #panel.minimized .dial-icon { opacity:1; }

    .ph { display:flex; align-items:center; justify-content:space-between; padding:0 0 8px; cursor:grab; margin-bottom:12px; border-bottom:1px solid var(--border-sub); }
    .ph:active { cursor:grabbing; }
    .ph-title { font-size:15px; font-weight:600; color:var(--text-hi); letter-spacing:-0.01em; }
    .ph-right { display:flex; align-items:center; gap:5px; }
    .icon-btn { width:22px; height:22px; display:flex; align-items:center; justify-content:center; border:none; background:none; cursor:pointer; border-radius:6px; color:var(--icon-col); transition:color .12s,background .12s; }
    .icon-btn:hover { background:var(--bg-hover); color:var(--text-hi); }
    .tb-btn.copied { color:var(--text-mid); }
    .tb-btn.watching { color:var(--accent); background:var(--bg-hover); }
    .tb-btn.watching svg circle { animation:ts-live 1.5s ease-in-out infinite; }
    @keyframes ts-live { 0%,100%{opacity:1} 50%{opacity:.3} }
    .pick-btn.active { background:var(--accent); color:#fff; }
    .pick-btn.active:hover { background:var(--accent); color:#fff; }

    .toolbar { display:flex; align-items:center; gap:6px; height:36px; padding:0; margin-bottom:6px; }
    .tb-btn { display:flex; align-items:center; justify-content:center; width:36px; height:36px; padding:0; flex-shrink:0; background:var(--sl-track); border:none; border-radius:var(--radius); cursor:pointer; transition:background .15s; color:var(--text-mid); }
    .tb-btn:hover { background:var(--bg-hover); }
    .tb-btn svg { width:16px; height:16px; }
    .version-wrap { position:relative; flex:1; min-width:0; }
    .tb-preset { display:flex; align-items:center; justify-content:space-between; width:100%; height:36px; padding:0 12px; font-family:inherit; font-size:13px; font-weight:500; color:var(--text-mid); background:var(--sl-track); border:none; border-radius:var(--radius); cursor:pointer; transition:background .15s; }
    .tb-preset:hover { background:var(--bg-hover); }
    .tb-preset .chev { opacity:0.6; }
    .version-menu { position:absolute; top:calc(100% + 6px); left:0; width:max-content; min-width:100%; background:var(--bg); border:1px solid var(--border); border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,0.08); padding:4px; display:none; z-index:100; }
    #panel:not(.panel-light) .version-menu { box-shadow:0 8px 24px rgba(0,0,0,0.4); }
    .version-menu.open { display:block; }
    .tb-preset[data-open] { background:var(--sl-fill); }
    .version-list { display:flex; flex-direction:column; gap:2px; }
    .version-item { padding:8px 10px; font-size:13px; font-weight:500; color:var(--text-mid); cursor:pointer; display:flex; align-items:center; justify-content:space-between; transition:background .15s; gap:8px; border-radius:8px; }
    .version-item:hover { background:var(--bg-hover); }
    .version-item.current { color:var(--text-hi); background:var(--sl-fill); }
    .version-item .ver-name { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:text; }
    .ver-name-input { flex:1; min-width:0; font:inherit; font-size:13px; font-weight:500; color:var(--text-hi); background:transparent; border:none; border-bottom:1px solid var(--text-mid); outline:none; padding:0 0 1px; }
    .ver-delete { display:flex; align-items:center; justify-content:center; width:24px; height:24px; padding:0; background:transparent; border:none; cursor:pointer; opacity:0; transition:opacity .15s; flex-shrink:0; color:var(--text-mid); }
    .version-item:hover .ver-delete { opacity:0.6; }
    .ver-delete:hover { opacity:1 !important; }
    .ver-delete svg { width:14px; height:14px; pointer-events:none; }
    .version-add-row { display:flex; align-items:center; justify-content:center; gap:6px; width:100%; padding:8px 10px; font-size:13px; font-weight:500; color:var(--text-mid); cursor:pointer; transition:background .15s,color .15s; border-radius:6px; }
    .version-add-row:hover { background:var(--bg-hover); color:var(--text-hi); }
    .version-add-row svg { width:12px; height:12px; }

    /* change badges — floating over each edited element. blue = single edit,
       green = group edit (agentation marker convention). Click to re-select. */
    .ts-badge { position:fixed; transform:translate(-50%,-50%) scale(1); min-width:20px; height:20px; padding:0 6px; border-radius:999px;
      color:#fff; font:700 10px/1 system-ui,-apple-system,sans-serif; display:flex; align-items:center; justify-content:center;
      pointer-events:auto; cursor:pointer; z-index:2147483646; box-shadow:0 2px 6px rgba(0,0,0,0.2), inset 0 0 0 1px rgba(0,0,0,0.04);
      transition:transform .15s cubic-bezier(.32,.72,0,1); will-change:transform; }
    .ts-badge.single { background:#3c82f7; }
    .ts-badge.group  { background:#22c55e; border-radius:5px; }
    .ts-badge:hover { transform:translate(-50%,-50%) scale(1.1); }
    .ts-badge svg { width:10px; height:10px; }

    .pb { overflow-y:visible; max-height:none; position:relative; }
    .select-hint { font-size:14px; color:var(--hint-col); text-align:center; letter-spacing:0.02em; display:none; }
    .select-hint.visible { display:flex; align-items:center; justify-content:center; min-height:160px; padding:12px; text-align:center; }
    /* matches the selected element's box (.ts-selbox): faint blue fill + ~55% blue outline */
    .ts-nowatch { display:none; margin-bottom:10px; padding:8px 10px; border-radius:var(--radius); font-size:11.5px; line-height:1.45;
      background:rgba(60,130,247,0.05); color:#1d4ed8; border:1px solid rgba(60,130,247,0.55); }
    #panel:not(.panel-light) .ts-nowatch { color:#93c5fd; background:rgba(60,130,247,0.08); border-color:rgba(60,130,247,0.5); }
    .ts-nowatch.visible { display:block; }
    .ts-nowatch-msg { display:block; margin-bottom:6px; }
    .ts-nowatch-field { display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:6px; cursor:pointer;
      background:rgba(60,130,247,0.1); border:1px solid rgba(60,130,247,0.45); transition:background .15s; }
    .ts-nowatch-field:hover { background:rgba(60,130,247,0.18); }
    .ts-nowatch-phrase { flex:1; font-size:12px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .ts-nowatch-icon { display:flex; flex-shrink:0; opacity:0.6; }
    .ts-nowatch-icon svg { width:13px; height:13px; }
    .ts-nowatch-field:hover .ts-nowatch-icon { opacity:1; }
    #panel:not(.panel-light) .ts-nowatch-field { background:rgba(60,130,247,0.13); border-color:rgba(60,130,247,0.5); }
    /* synced/live confirmation — shows when an agent is actually watching (edits apply live) */
    .ts-synced { display:none; align-items:center; gap:8px; margin-bottom:10px; padding:8px 10px; border-radius:var(--radius); font-size:11.5px; font-weight:500;
      background:rgba(34,197,94,0.09); color:#15803d; border:1px solid rgba(34,197,94,0.32); }
    .ts-synced.visible { display:flex; }
    .ts-synced-dot { width:7px; height:7px; border-radius:50%; background:#22c55e; flex-shrink:0; box-shadow:0 0 0 0 rgba(34,197,94,0.5); animation:ts-syncpulse 1.9s ease-in-out infinite; }
    @keyframes ts-syncpulse { 0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.45);} 50%{box-shadow:0 0 0 4px rgba(34,197,94,0);} }
    #panel:not(.panel-light) .ts-synced { color:#4ade80; background:rgba(34,197,94,0.13); border-color:rgba(34,197,94,0.3); }
    .flip { position:relative; transform-style:preserve-3d; transition:transform .38s cubic-bezier(.4,0,.2,1), height .38s cubic-bezier(.4,0,.2,1); }
    .flip.flipped { transform:rotateY(180deg); }
    .face-front, .face-back { -webkit-backface-visibility:hidden; backface-visibility:hidden; }
    .face-back { position:absolute; top:0; left:0; width:100%; transform:rotateY(180deg); display:none; }
    .set-head { display:flex; align-items:center; gap:6px; padding-bottom:10px; margin-bottom:8px; border-bottom:1px solid var(--border-sub); }
    .set-title { font-size:14px; font-weight:600; color:var(--text-hi); letter-spacing:-0.01em; }
    .set-list { display:flex; flex-direction:column; padding-bottom:8px; }
    .set-row { display:flex; align-items:center; justify-content:space-between; height:38px; }
    .set-label { font-size:13px; color:var(--text-mid); }
    .set-sw { position:relative; width:34px; height:20px; border-radius:20px; border:none; background:var(--sl-track); cursor:pointer; padding:0; flex-shrink:0; transition:background .15s; }
    .set-sw[aria-checked="true"] { background:var(--accent); }
    .set-knob { position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,0.3); transition:transform .15s; }
    .set-sw[aria-checked="true"] .set-knob { transform:translateX(14px); }
    .set-sep { height:1px; background:var(--border-sub); margin:6px 0; }
    .set-status-row { display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:28px; }
    .set-val { font-size:12px; color:var(--text-lo); max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:right; }
    .set-val.ok { color:#2ea043; }
    .set-val.bad { color:#e5534b; }
    .set-hint { font-size:11px; color:var(--text-lo); padding-top:6px; line-height:1.5; }
    /* Section folders — copied from DialKit data-multiple="true" mode */
    .section { margin:0; padding-bottom:0; border-top:1px solid var(--border-sub); border-bottom:none; }
    .section:first-child { border-top:none; margin-top:0; }
    /* when the message box is showing, divide it from the first section (same rhythm as other section dividers) */
    .ts-nowatch.visible ~ #controls .section:first-child, .ts-synced.visible ~ #controls .section:first-child { border-top:1px solid var(--border-sub); }
    .section-head { display:flex; align-items:center; justify-content:space-between; height:44px; padding:0; cursor:pointer; user-select:none; }
    .section-head span { font-size:14px; font-weight:600; line-height:20px; color:var(--text-mid); letter-spacing:-0.01em; transform:translateY(-0.5px); transition:color .15s; }
    .section-head:hover span { color:var(--text-hi); }
    .section-chev { width:20px; height:20px; padding:2px; box-sizing:border-box; color:var(--text-mid); opacity:0.6; flex-shrink:0; }
    .section-content { overflow:hidden; }
    .section-content-inner { display:flex; flex-direction:column; gap:6px; padding-top:4px; padding-bottom:12px; }
    .row { display:flex; align-items:center; padding:4px 10px; gap:8px; min-height:36px; }

    .style-seg { display:flex; padding:0; gap:0; }
    .style-btn { flex:1; height:36px; border:none; background:var(--sl-track); color:var(--text-lo); cursor:pointer; transition:background .15s,color .15s; display:flex; align-items:center; justify-content:center; }
    .style-btn:first-child { border-radius:var(--radius) 0 0 var(--radius); }
    .style-btn:last-child { border-radius:0 var(--radius) var(--radius) 0; }
    .style-btn:not(:first-child):not(:last-child) { border-radius:0; }
    .style-btn:hover { background:var(--bg-hover); color:var(--text-mid); }
    .style-btn.active { background:var(--sl-fill); color:var(--text-hi); }
    .align-seg { display:flex; padding:0; gap:0; }
    .align-btn { flex:1; height:36px; border:none; background:var(--sl-track); color:var(--text-lo); cursor:pointer; transition:background .15s,color .15s; display:flex; align-items:center; justify-content:center; }
    .align-btn:first-child { border-radius:var(--radius) 0 0 var(--radius); }
    .align-btn:last-child { border-radius:0 var(--radius) var(--radius) 0; }
    .align-btn:not(:first-child):not(:last-child) { border-radius:0; }
    .align-btn:hover { background:var(--bg-hover); color:var(--text-mid); }
    .align-btn.active { background:var(--sl-fill); color:var(--text-hi); }
    .reset-row { padding:0 0 12px; margin-top:2px; border-top:1px solid var(--border-sub); padding-top:10px; }
    .reset-btn { width:100%; padding:8px; background:rgba(255,60,60,0.07); border:none; border-radius:var(--radius); color:rgba(255,100,100,0.6); font-size:13px; font-weight:500; cursor:pointer; transition:background .15s,color .15s; }
    .reset-btn:hover { background:rgba(255,60,60,0.13); color:rgba(255,120,120,0.9); }

    .sl-row { padding:0; }
    #controls { display:flex; flex-direction:column; gap:0; transition:opacity .15s; }
    #controls.disabled { display:none; }
    .ts-slider { position:relative; height:36px; background:var(--sl-track); border-radius:var(--radius); overflow:hidden; cursor:pointer; touch-action:none; user-select:none; }
    .ts-slider.snapping { transition:width .34s cubic-bezier(.22,1,.36,1),transform .34s cubic-bezier(.22,1,.36,1); }
    .ts-slider-hashmarks { position:absolute; inset:0; pointer-events:none; }
    .ts-slider-hashmark { position:absolute; top:50%; width:1px; height:8px; border-radius:999px; transform:translate(-50%,-50%); background:transparent; transition:background .2s; }
    .ts-slider.active .ts-slider-hashmark { background:var(--sl-hash); }
    .ts-slider-fill { position:absolute; top:0; bottom:0; left:0; width:0%; background:var(--sl-fill); transition:background .15s; pointer-events:none; }
    .ts-slider.active .ts-slider-fill { background:var(--sl-fill-act); }
    .ts-slider-handle { position:absolute; top:50%; left:0; width:3px; height:20px; border-radius:999px; background:var(--sl-handle); pointer-events:none; opacity:0; transform:translateY(-50%) scaleX(0.25); transition:opacity .18s ease,transform .18s cubic-bezier(.32,.72,0,1); }
    .ts-slider-label { position:absolute; left:10px; top:50%; transform:translateY(calc(-50% - 0.5px)); font-size:13px; font-weight:500; color:var(--text-mid); pointer-events:none; transition:color .15s; white-space:nowrap; }
    .ts-slider.active .ts-slider-label { color:var(--text-hi); }
    .ts-slider-value { position:absolute; right:10px; top:50%; transform:translateY(calc(-50% + 0.5px)); font-size:13px; font-weight:500; font-family:'Geist Mono',monospace; color:var(--text-val); pointer-events:auto; border-bottom:1px solid transparent; padding-bottom:1px; transition:color .15s,border-color .15s; }
    .ts-slider.active .ts-slider-value { color:var(--text-hi); }
    .ts-slider-value.editable { border-bottom-color:var(--text-mid); cursor:text; }
    .ts-slider-input { position:absolute; right:10px; top:50%; transform:translateY(-50%); width:5ch; text-align:right; background:transparent; border:none; border-bottom:1px solid var(--text-mid); outline:none; padding:0 0 1px 0; font-size:13px; font-weight:500; font-family:'Geist Mono',monospace; color:var(--text-hi); display:none; }

    .font-picker { padding:0; }
    .font-trigger { width:100%; display:flex; align-items:center; justify-content:space-between; gap:8px; height:36px; background:var(--sl-track); border:none; border-radius:var(--radius); color:var(--text-mid); font-size:13px; font-weight:500; padding:0 12px; cursor:pointer; transition:background .15s; text-align:left; }
    .font-trigger:hover { background:var(--bg-hover); }
    .font-trigger-name { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; line-height:1.1; }
    .font-trigger .chev { color:var(--text-mid); flex-shrink:0; opacity:0.6; transition:transform .18s cubic-bezier(.32,.72,0,1); }
    .font-picker.open .font-trigger .chev { transform:rotate(180deg); }
    .font-picker.open .font-trigger { background:var(--sl-fill); }
    .font-list { display:none; margin-top:5px; max-height:232px; overflow-y:auto; -ms-overflow-style:none; scrollbar-width:none; background:var(--bg); border:1px solid var(--border); border-radius:var(--radius); padding:4px; box-shadow:0 8px 24px rgba(0,0,0,0.4); }
    .font-picker.open .font-list { display:block; }
    .font-group-label { font-size:11px; font-weight:600; letter-spacing:0.05em; text-transform:uppercase; color:var(--text-lo); padding:4px 8px 4px; }
    .font-item { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 10px; border-radius:6px; cursor:pointer; color:var(--text-mid); font-size:13px; font-weight:500; line-height:1.15; transition:background .15s,color .15s; }
    .font-item span:first-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .font-item:hover { background:var(--bg-hover); }
    .font-item.current { color:var(--text-hi); background:var(--sl-fill); }
    .fi-check { color:#4ade80; font-size:11px; flex-shrink:0; opacity:0; }
    .font-item.current .fi-check { opacity:1; }

    /* host-page highlighters (position:fixed escapes shadow, tracks viewport).
       NOTE: these are siblings of #panel, so #panel's --accent is out of scope —
       use literal colors here. */
    .ts-box { position:fixed; pointer-events:none; z-index:2147483646; border-radius:4px; display:none; }
    #hoverBox { border:2px solid rgba(60,130,247,0.45); background:rgba(60,130,247,0.05); }
    /* dragging a marquee is always a multi-select -> green (agentation) */
    #marquee { border:1.5px dashed rgba(34,197,94,0.7); background:rgba(34,197,94,0.08); }
    /* one outline per selected element — LIGHT semi-transparent border + faint
       fill, matching agentation (border = accent/green ~55%, fill ~5%, no halo). */
    .ts-selbox { position:fixed; pointer-events:none; z-index:2147483646; border-radius:4px;
      border:2px solid rgba(60,130,247,0.55); background:rgba(60,130,247,0.05); }
    .ts-selbox.group { border-color:rgba(34,197,94,0.6); background:rgba(34,197,94,0.06); }
    /* on-canvas resize handles: two dots on the single selected element's left/right edge */
    .ts-handle { position:fixed; width:14px; height:14px; box-sizing:border-box; background:rgba(60,130,247,1);
      border:2px solid #fff; border-radius:50%; box-shadow:0 1px 4px rgba(0,0,0,0.35); cursor:ew-resize;
      z-index:2147483647; pointer-events:auto; display:none; }
    /* on-canvas "select the frame around this" button — the visible way to climb to the container */
    .ts-frame { position:fixed; display:none; align-items:center; justify-content:center;
      width:24px; height:24px; box-sizing:border-box; background:rgba(60,130,247,1); color:#fff;
      border:2px solid #fff; border-radius:7px; box-shadow:0 1px 5px rgba(0,0,0,0.4); cursor:pointer;
      z-index:2147483647; pointer-events:auto; }
    .ts-frame:hover { background:rgba(40,110,230,1); }
    .ts-frame svg { width:13px; height:13px; }
    /* dark pill descriptor label (agentation hover tooltip) */
    .ts-label { position:fixed; display:none; z-index:2147483647; pointer-events:none;
      font:500 11px/1.3 system-ui,-apple-system,sans-serif; color:#fff; background:rgba(0,0,0,0.85);
      padding:4px 8px; border-radius:6px; max-width:340px; white-space:nowrap; overflow:hidden;
      text-overflow:ellipsis; box-shadow:0 2px 10px rgba(0,0,0,0.35); }
  `;

  const COPY ='<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M8 6C8 4.343 9.343 3 11 3h2c1.657 0 3 1.343 3 3v1H8V6z" stroke="currentColor" stroke-width="1.5"/><path d="M16 5h1c1.657 0 3 1.343 3 3v3M8 5H7c-1.657 0-3 1.343-3 3v10c0 1.657 1.343 3 3 3h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M19.24 16.19l-.7-1.81a.5.5 0 00-.93 0l-.7 1.81a1.5 1.5 0 01-.87.88l-1.81.7a.5.5 0 000 .93l1.81.7c.26.1.47.32.57.57l.7 1.81a.5.5 0 00.93 0l.7-1.81c.1-.26.32-.47.57-.57l1.81-.7a.5.5 0 000-.93l-1.81-.7a1.5 1.5 0 01-.57-.57z" fill="currentColor"/></svg>';
  const ADDV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h6M15 15h6M18 12v6M4 18h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  const EYE_OPEN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4.91516 12.7108C4.63794 12.2883 4.63705 11.7565 4.91242 11.3328C5.84146 9.9033 8.30909 6.74994 12 6.74994C15.6909 6.74994 18.1585 9.9033 19.0876 11.3328C19.3629 11.7565 19.3621 12.2883 19.0848 12.7108C18.1537 14.13 15.6873 17.2499 12 17.2499C8.31272 17.2499 5.8463 14.13 4.91516 12.7108Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 14.25C13.2426 14.25 14.25 13.2426 14.25 12C14.25 10.7574 13.2426 9.75 12 9.75C10.7574 9.75 9.75 10.7574 9.75 12C9.75 13.2426 10.7574 14.25 12 14.25Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const EYE_CLOSED = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18.6025 9.28503C18.9174 8.9701 19.4364 8.99481 19.7015 9.35271C20.1484 9.95606 20.4943 10.507 20.7342 10.9199C21.134 11.6086 21.1329 12.4454 20.7303 13.1328C20.2144 14.013 19.2151 15.5225 17.7723 16.8193C16.3293 18.1162 14.3852 19.2497 12.0008 19.25C11.4192 19.25 10.8638 19.1823 10.3355 19.0613C9.77966 18.934 9.63498 18.2525 10.0382 17.8493C10.2412 17.6463 10.5374 17.573 10.8188 17.6302C11.1993 17.7076 11.5935 17.75 12.0008 17.75C13.8848 17.7497 15.4867 16.8568 16.7693 15.7041C18.0522 14.5511 18.9606 13.1867 19.4363 12.375C19.5656 12.1543 19.5659 11.8943 19.4373 11.6729C19.2235 11.3049 18.921 10.8242 18.5364 10.3003C18.3085 9.98991 18.3302 9.5573 18.6025 9.28503ZM12.0008 4.75C12.5814 4.75006 13.1358 4.81803 13.6632 4.93953C14.2182 5.06741 14.362 5.74812 13.9593 6.15091C13.7558 6.35435 13.4589 6.42748 13.1771 6.36984C12.7983 6.29239 12.4061 6.25006 12.0008 6.25C10.1167 6.25 8.51415 7.15145 7.23028 8.31543C5.94678 9.47919 5.03918 10.8555 4.56426 11.6729C4.43551 11.8945 4.43582 12.1542 4.56524 12.375C4.77587 12.7343 5.07189 13.2012 5.44718 13.7105C5.67623 14.0213 5.65493 14.4552 5.38193 14.7282C5.0671 15.0431 4.54833 15.0189 4.28292 14.6614C3.84652 14.0736 3.50813 13.5369 3.27129 13.1328C2.86831 12.4451 2.86717 11.6088 3.26739 10.9199C3.78185 10.0345 4.77959 8.51239 6.22247 7.2041C7.66547 5.89584 9.61202 4.75 12.0008 4.75Z" fill="currentColor"/><path d="M5 19L19 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  const THEME_DARK = '<svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M15.5 10.4955C15.4037 11.5379 15.0124 12.5314 14.3721 13.3596C13.7317 14.1878 12.8688 14.8165 11.8841 15.1722C10.8995 15.5278 9.83397 15.5957 8.81217 15.3679C7.79038 15.1401 6.8546 14.6259 6.11434 13.8857C5.37408 13.1454 4.85995 12.2096 4.63211 11.1878C4.40427 10.166 4.47215 9.10048 4.82781 8.11585C5.18346 7.13123 5.81218 6.26825 6.64039 5.62791C7.4686 4.98756 8.46206 4.59634 9.5045 4.5C8.89418 5.32569 8.60049 6.34302 8.67685 7.36695C8.75321 8.39087 9.19454 9.35339 9.92058 10.0794C10.6466 10.8055 11.6091 11.2468 12.6331 11.3231C13.657 11.3995 14.6743 11.1058 15.5 10.4955Z" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const THEME_LIGHT = '<svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M9.99999 12.7082C11.4958 12.7082 12.7083 11.4956 12.7083 9.99984C12.7083 8.50407 11.4958 7.2915 9.99999 7.2915C8.50422 7.2915 7.29166 8.50407 7.29166 9.99984C7.29166 11.4956 8.50422 12.7082 9.99999 12.7082Z" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 3.9585V5.057M10 14.943V16.041M5.727 5.727L6.507 6.506M13.493 13.493L14.273 14.273M3.958 10H5.057M14.943 10H16.042M5.727 14.273L6.507 13.493M13.493 6.506L14.273 5.727" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const MINI = '<svg width="10" height="2" viewBox="0 0 10 2" fill="none"><rect width="10" height="1.5" rx="0.75" fill="currentColor"/></svg>';
  const GEAR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M19.4 13a7.5 7.5 0 000-2l1.7-1.3-1.8-3.1-2 .8a7.5 7.5 0 00-1.7-1l-.3-2.1H9.7l-.3 2.1a7.5 7.5 0 00-1.7 1l-2-.8-1.8 3.1L5.6 11a7.5 7.5 0 000 2l-1.7 1.3 1.8 3.1 2-.8a7.5 7.5 0 001.7 1l.3 2.1h4.6l.3-2.1a7.5 7.5 0 001.7-1l2 .8 1.8-3.1L19.4 13z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
  const BACK_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const WATCH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M8.8 8.8a4.5 4.5 0 0 0 0 6.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M15.2 8.8a4.5 4.5 0 0 1 0 6.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6 6a9 9 0 0 0 0 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18 6a9 9 0 0 1 0 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const CHEV = '<svg class="chev" width="8" height="5" viewBox="0 0 8 5" fill="none"><path d="M1 1l3 3 3-3" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const CHEV_SEC = '<svg class="section-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

  const slider = (prop, label, min, max, step, val) => `
    <div class="sl-row"><div class="ts-slider" data-prop="${prop}" data-min="${min}" data-max="${max}" data-step="${step}">
      <div class="ts-slider-hashmarks"></div><div class="ts-slider-fill"></div><div class="ts-slider-handle"></div>
      <span class="ts-slider-label">${label}</span><span class="ts-slider-value" data-v="${prop}">${val}</span>
      <input class="ts-slider-input" type="number" min="${min}" max="${max}" step="${step}">
    </div></div>`;

  const HTML = `
    <div id="panel" data-origin-x="right">
      <div class="dial-icon">T</div>
      <div class="panel-inner">
        <div class="ph" id="dragHandle">
          <span class="ph-title">TypeSet</span>
          <div class="ph-right">
            <button class="icon-btn" id="badgeToggleBtn" title="Toggle badges">${EYE_OPEN}</button>
            <button class="icon-btn" id="themeBtn" title="Toggle theme">${THEME_DARK}</button>
            <button class="icon-btn" id="settingsBtn" title="Settings">${GEAR}</button>
            <button class="icon-btn" id="minBtn" title="Minimize">${MINI}</button>
          </div>
        </div>
        <div class="flip" id="flip">
        <div class="face-front" id="frontFace">
        <div class="pb" id="panelBody">
          <div class="toolbar" id="toolbar">
            <button class="tb-btn" id="addVersionBtn" title="Add version">${ADDV}</button>
            <div class="version-wrap" id="versionWrap">
              <button class="tb-preset" id="versionBtn"><span id="versionLabel">Version 1</span>${CHEV}</button>
              <div class="version-menu" id="versionMenu"></div>
            </div>
            <button class="tb-btn" id="copyBtn" title="Copy CSS — also sends this edit to your agent to write into the source">${COPY}</button>
            <button class="tb-btn tb-watch" id="watchBtn" title="Watch: auto-send every edit to your agent as you scrub — no Copy needed. Click to start.">${WATCH}</button>
          </div>
          <div class="ts-nowatch" id="noWatch">
            <span class="ts-nowatch-msg">For live edits actioned via MCP, paste in your chat:</span>
            <div class="ts-nowatch-field" id="noWatchCopy" title="Copy">
              <span class="ts-nowatch-phrase">watch my TypeSet edits</span>
              <span class="ts-nowatch-icon" id="noWatchIcon"><svg viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M5 15V5a2 2 0 0 1 2-2h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>
            </div>
          </div>
          <div class="ts-synced" id="liveMsg"><span class="ts-synced-dot"></span>Live — your edits apply as you scrub</div>
          <div class="select-hint visible" id="selectHint">Select text to edit</div>
          <div id="controls" class="disabled">
            <div class="section">
              <div class="section-head" data-sec="typography"><span>Typography</span>${CHEV_SEC}</div>
              <div class="section-content" id="sec-typography"><div class="section-content-inner">
                ${slider('fontSize','Size',8,120,0.5,'—')}
                ${slider('fontWeight','Weight',100,900,100,'—')}
                ${slider('lineHeight','Line Height',0.8,3.0,0.05,'—')}
                ${slider('letterSpacing','Spacing',-0.1,0.4,0.005,'—')}
              </div></div>
            </div>
            <div class="section">
              <div class="section-head" data-sec="position"><span>Position</span>${CHEV_SEC}</div>
              <div class="section-content" id="sec-position"><div class="section-content-inner">
                ${slider('translateX','X',-400,400,1,'0px')}
                ${slider('translateY','Y',-400,400,1,'0px')}
              </div></div>
            </div>
            <div class="section">
              <div class="section-head" data-sec="layout"><span>Layout</span>${CHEV_SEC}</div>
              <div class="section-content" id="sec-layout"><div class="section-content-inner">
                ${slider('maxWidth','Width',40,3000,1,'—')}
                ${slider('padding','Padding',0,80,1,'—')}
                ${slider('marginTop','Space',0,200,1,'—')}
                ${slider('borderRadius','Radius',0,50,1,'—')}
                ${slider('opacity','Opacity',0,100,1,'—')}
              </div></div>
            </div>
            <div class="section">
              <div class="section-head" data-sec="font"><span>Font</span>${CHEV_SEC}</div>
              <div class="section-content" id="sec-font"><div class="section-content-inner">
                <div class="font-picker" id="fontPicker">
                  <button class="font-trigger" id="fontTrigger" type="button">
                    <span class="font-trigger-name" id="fontTriggerName">—</span>${CHEV}
                  </button>
                  <div class="font-list" id="fontList"></div>
                </div>
                <div class="style-seg">
                  <button class="style-btn" data-style="italic" title="Italic"><svg width="12" height="14" viewBox="0 0 12 14" fill="none"><line x1="4" y1="13" x2="8" y2="1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="2" y1="13" x2="7" y2="13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="5" y1="1" x2="10" y2="1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg></button>
                  <button class="style-btn" data-style="bold" title="Bold"><svg width="12" height="14" viewBox="-1 -1 13 16" fill="none"><path d="M1 1h4.5a2.5 2.5 0 010 5H1V1zM1 6h5a3 3 0 010 6H1V6z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></button>
                  <button class="style-btn" data-style="underline" title="Underline"><svg width="12" height="14" viewBox="0 0 12 14" fill="none"><path d="M2 1v5a4 4 0 008 0V1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="1" y1="13" x2="11" y2="13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg></button>
                </div>
              </div></div>
            </div>
            <div class="section">
              <div class="section-head" data-sec="align"><span>Align</span>${CHEV_SEC}</div>
              <div class="section-content" id="sec-align"><div class="section-content-inner">
                <div class="align-seg">
                  <button class="align-btn" data-align="left" title="Left"><svg width="12" height="10" viewBox="0 0 12 10" fill="none"><line x1="0" y1="1" x2="12" y2="1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="0" y1="5" x2="8.4" y2="5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="0" y1="9" x2="6.6" y2="9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>
                  <button class="align-btn" data-align="center" title="Center"><svg width="12" height="10" viewBox="0 0 12 10" fill="none"><line x1="0" y1="1" x2="12" y2="1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="1.8" y1="5" x2="10.2" y2="5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="2.7" y1="9" x2="9.3" y2="9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>
                  <button class="align-btn" data-align="right" title="Right"><svg width="12" height="10" viewBox="0 0 12 10" fill="none"><line x1="0" y1="1" x2="12" y2="1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="3.6" y1="5" x2="12" y2="5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="5.4" y1="9" x2="12" y2="9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>
                  <button class="align-btn" data-align="justify" title="Justify"><svg width="12" height="10" viewBox="0 0 12 10" fill="none"><line x1="0" y1="1" x2="12" y2="1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="0" y1="5" x2="12" y2="5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="0" y1="9" x2="7.2" y2="9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>
                </div>
              </div></div>
            </div>
            <div class="reset-row"><button class="reset-btn" id="resetBtn">Reset</button></div>
          </div>
        </div>
        </div>
        <div class="face-back" id="settingsFace">
          <div class="set-head">
            <button class="icon-btn" id="settingsBack" title="Back">${BACK_SVG}</button>
            <span class="set-title">Settings</span>
          </div>
          <div class="set-list">
            <div class="set-row"><span class="set-label">Show tips</span><button class="set-sw" id="setTips" role="switch" aria-checked="true"><span class="set-knob"></span></button></div>
            <div class="set-hint" style="padding:0 0 4px">Hover tooltips on the toolbar buttons.</div>
            <div class="set-sep"></div>
            <div class="set-status-row"><span class="set-label">Routing to</span><span class="set-val" id="setProject">—</span></div>
            <div class="set-status-row"><span class="set-label">Connection</span><span class="set-val" id="setDaemon">checking…</span></div>
            <div class="set-status-row"><span class="set-label">Agent</span><span class="set-val" id="setAgent">checking…</span></div>
          </div>
        </div>
        </div>
      </div>
    </div>
    <div class="ts-box" id="hoverBox"></div>
    <div class="ts-box" id="marquee"></div>
    <div class="ts-label" id="hoverLabel"></div>`;

  // ── Mount in an isolated Shadow DOM ──
  const hostEl = document.createElement('div');
  hostEl.id = 'typeset-overlay-host';
  hostEl.style.all = 'initial';
  const root = hostEl.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${CSS}</style>${HTML}`;
  (document.body || document.documentElement).appendChild(hostEl);

  const $ = id => root.getElementById(id);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const panel = $('panel'), panelInner = panel.querySelector('.panel-inner');
  const selectHint = $('selectHint'), controls = $('controls');
  const copyBtn = $('copyBtn'), watchBtn = $('watchBtn'), resetBtn = $('resetBtn'), themeBtn = $('themeBtn'), minBtn = $('minBtn');
  const hoverBox = $('hoverBox'), marquee = $('marquee'), hoverLabel = $('hoverLabel'), phTitle = panel.querySelector('.ph-title');
  const fontPicker = $('fontPicker'), fontTrigger = $('fontTrigger'), fontTriggerName = $('fontTriggerName'), fontList = $('fontList');

  let active = null, txX = 0, txY = 0;
  let selection = [];             // all currently-selected host elements (active = the primary/last)
  const edited = new Set();       // host elements TypeSet has changed (for Copy CSS)

  // ── Undo (stores live node refs — safe, no reload during a session) ──
  const undoStack = [];
  // Each undo entry is a snapshot of EVERY selected element (multi-select safe).
  function snapOne(el) {
    const s = el.style;
    return { el, fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight,
             letterSpacing: s.letterSpacing, fontFamily: s.fontFamily, textAlign: s.textAlign, transform: s.transform, maxWidth: s.maxWidth, width: s.width, marginTop: s.marginTop, padding: s.padding, borderRadius: s.borderRadius, opacity: s.opacity, fontStyle: s.fontStyle, textDecoration: s.textDecoration };
  }
  function pushUndo() { if (selection.length) undoStack.push(selection.map(snapOne)); }
  function popUndo() {
    const entry = undoStack.pop(); if (!entry) return;
    entry.forEach(s => {
      const st = s.el.style;
      st.fontSize = s.fontSize; st.fontWeight = s.fontWeight; st.lineHeight = s.lineHeight;
      st.letterSpacing = s.letterSpacing; st.fontFamily = s.fontFamily; st.textAlign = s.textAlign; st.transform = s.transform; st.maxWidth = s.maxWidth; st.width = s.width; st.marginTop = s.marginTop; st.padding = s.padding; st.borderRadius = s.borderRadius; st.opacity = s.opacity; st.fontStyle = s.fontStyle; st.textDecoration = s.textDecoration;
    });
    if (active) { const m = new DOMMatrix(getComputedStyle(active).transform); txX = Math.round(m.m41); txY = Math.round(m.m42); syncFrom(active); }
    saveCurrentVersion(); updateSelBoxes();
  }

  // ── Versions + change badges (keyed on live element refs, not data-id) ──
  let versions = [{ name: 'Version 1', styles: [] }];
  let currentVersionIdx = 0;
  const badgeNodes = [];  // {el, node}

  const emptySnap = el => ({ el, fontSize: '', fontWeight: '', lineHeight: '', letterSpacing: '', fontFamily: '', textAlign: '', transform: '', maxWidth: '', width: '', marginTop: '', padding: '', borderRadius: '', opacity: '', fontStyle: '', textDecoration: '' });
  // As new elements are touched, backfill every existing version with an empty
  // snapshot so switching to an OLDER version correctly clears them.
  function trackEdited(el) {
    if (edited.has(el)) return;
    edited.add(el);
    versions.forEach(v => { if (!v.styles.some(o => o.el === el)) v.styles.push(emptySnap(el)); });
  }
  function captureAllStyles() {
    return [...edited].map(el => ({ el, fontSize: el.style.fontSize, fontWeight: el.style.fontWeight, lineHeight: el.style.lineHeight,
      letterSpacing: el.style.letterSpacing, fontFamily: el.style.fontFamily, textAlign: el.style.textAlign, transform: el.style.transform, maxWidth: el.style.maxWidth, width: el.style.width, marginTop: el.style.marginTop, padding: el.style.padding, borderRadius: el.style.borderRadius, opacity: el.style.opacity, fontStyle: el.style.fontStyle, textDecoration: el.style.textDecoration }));
  }
  function applyAllStyles(arr) {
    arr.forEach(o => { const s = o.el.style; s.fontSize = o.fontSize; s.fontWeight = o.fontWeight; s.lineHeight = o.lineHeight;
      s.letterSpacing = o.letterSpacing; s.fontFamily = o.fontFamily; s.textAlign = o.textAlign; s.transform = o.transform; s.maxWidth = o.maxWidth; s.width = o.width; s.marginTop = o.marginTop; s.padding = o.padding; s.borderRadius = o.borderRadius; s.opacity = o.opacity; s.fontStyle = o.fontStyle; s.textDecoration = o.textDecoration; });
  }
  function saveCurrentVersion() { versions[currentVersionIdx].styles = captureAllStyles(); updateBadges(); }
  function switchVersion(idx) {
    saveCurrentVersion(); currentVersionIdx = idx; applyAllStyles(versions[idx].styles); updateBadges();
    txX = 0; txY = 0;
    if (active) { const m = new DOMMatrix(getComputedStyle(active).transform); txX = Math.round(m.m41); txY = Math.round(m.m42); syncFrom(active); updateSelBoxes(); }
    renderVersionMenu();
  }
  function addVersion() {
    saveCurrentVersion();
    versions.push({ name: 'Version ' + (versions.length + 1), styles: captureAllStyles() });
    currentVersionIdx = versions.length - 1; renderVersionMenu();
  }
  const TRASH_SVG = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 6.5l.807 11.706A2.8 2.8 0 008.8 21h6.4a2.8 2.8 0 002.793-2.794L19 6.5M10 11v5M14 11v5M3.5 6h17M8.07 5.75A4 4 0 0112 2.5a4 4 0 013.93 3.25" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
  function deleteVersion(idx) {
    if (versions.length <= 1) return;
    versions.splice(idx, 1);
    if (currentVersionIdx >= versions.length) currentVersionIdx = versions.length - 1;
    applyAllStyles(versions[currentVersionIdx].styles);
    updateBadges(); renderVersionMenu();
  }
  function renderVersionMenu() {
    const menu = $('versionMenu'); $('versionLabel').textContent = versions[currentVersionIdx].name;
    const items = versions.map((v, i) =>
      `<div class="version-item ${i === currentVersionIdx ? 'current' : ''}" data-idx="${i}"><span class="ver-name">${v.name}</span>${versions.length > 1 ? `<button class="ver-delete" data-del="${i}" title="Delete">${TRASH_SVG}</button>` : ''}</div>`
    ).join('');
    menu.innerHTML = `<div class="version-list">${items}</div>`;
    menu.querySelectorAll('.version-item').forEach(it => {
      const idx = parseInt(it.dataset.idx);
      it.addEventListener('click', e => {
        if (e.target.closest('.ver-delete') || e.target.closest('.ver-name-input')) return;
        switchVersion(idx); closeVersionMenu();
      });
      const nameEl = it.querySelector('.ver-name');
      nameEl.addEventListener('dblclick', e => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.className = 'ver-name-input';
        input.value = versions[idx].name;
        nameEl.replaceWith(input);
        input.focus(); input.select();
        const commit = () => {
          const val = input.value.trim() || versions[idx].name;
          versions[idx].name = val;
          renderVersionMenu();
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', e2 => { if (e2.key === 'Enter') commit(); if (e2.key === 'Escape') renderVersionMenu(); });
        input.addEventListener('pointerdown', e2 => e2.stopPropagation());
      });
    });
    menu.querySelectorAll('.ver-delete').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation(); deleteVersion(parseInt(btn.dataset.del));
    }));
  }
  function closeVersionMenu() { $('versionMenu').classList.remove('open'); }
  $('versionBtn').addEventListener('click', e => { e.stopPropagation(); $('versionMenu').classList.toggle('open'); });
  $('addVersionBtn').addEventListener('click', e => { e.stopPropagation(); addVersion(); });
  root.addEventListener('click', e => { if (!e.target.closest('#versionWrap')) closeVersionMenu(); });

  const PENCIL_SVG = '<svg viewBox="0 0 16 16" fill="none"><path d="M11.38 6.96L9.06 4.63M11.38 6.96L6.75 11.57c-.13.13-.3.22-.47.26l-1.98.48c-.36.09-.69-.24-.6-.6l.47-1.95c.04-.18.13-.34.26-.47L9.06 4.63M11.38 6.96l.97-.97a1.64 1.64 0 00-2.33-2.32l-.96.96" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const isChanged = el => { const s = el.style; return !!(s.fontFamily || s.fontSize || s.fontWeight || s.lineHeight || s.letterSpacing || s.textAlign || s.maxWidth || s.width || s.padding || s.borderRadius || s.opacity || s.fontStyle || s.textDecoration || (s.transform && s.transform !== 'none')); };
  function updateBadges() {
    badgeNodes.forEach(b => b.node.remove()); badgeNodes.length = 0;
    const seenGroupNums = new Set();
    edited.forEach(el => {
      if (!isChanged(el)) return;
      const m = el.__tsMark, group = !!(m && m.group);
      if (group && m && m.num != null) {
        if (seenGroupNums.has(m.num)) return;
        seenGroupNums.add(m.num);
      }
      const node = document.createElement('div');
      node.className = 'ts-badge ' + (group ? 'group' : 'single');
      const label = m && m.num != null ? String(m.num) : '•';
      node.textContent = label;
      node.title = (group ? 'Group edit' : 'Single edit') + ' — click to select';
      node.addEventListener('mouseenter', () => { node.innerHTML = PENCIL_SVG; });
      node.addEventListener('mouseleave', () => { node.textContent = label; });
      node.addEventListener('click', e => {
        e.stopPropagation(); e.preventDefault();
        if (minimized) expand();
        if (group && m.els.length) setSelection(m.els.filter(x => document.contains(x)));
        else selectEl(el);
      });
      if (!badgesVisible) node.style.display = 'none';
      root.appendChild(node); badgeNodes.push({ el, node });
    });
    positionBadges();
  }
  function positionBadges() {
    badgeNodes.forEach(b => { const r = b.el.getBoundingClientRect(); b.node.style.left = r.left + 'px'; b.node.style.top = r.top + 'px'; });
  }

  // ── Panel drag + expand/collapse (dialkit-derived) ──
  const ICON = 36, PANEL_W = 260, DRAG_THRESHOLD = 8;
  let minimized = false, iconX = 0, iconY = 0, originX = 'right';
  let pDrag = false, pOx = 0, pOy = 0, dsx = 0, dsy = 0, dragMoved = false, suppressClick = false;

  const computeOrigin = () => (iconX + ICON / 2) < window.innerWidth / 2 ? 'left' : 'right';
  function layoutCollapsed() { panel.style.right = 'auto'; panel.style.left = iconX + 'px'; panel.style.top = iconY + 'px'; }
  function layoutExpanded() {
    const h = panelInner.offsetHeight || 300;
    let left = originX === 'right' ? (iconX + ICON - PANEL_W) : iconX;
    left = clamp(left, 8, window.innerWidth - PANEL_W - 8);
    const top = clamp(iconY, 8, Math.max(8, window.innerHeight - h - 8));
    panel.style.right = 'auto'; panel.style.left = left + 'px'; panel.style.top = top + 'px';
  }
  function resyncHeight() {
    if (minimized || resizing) return;   // smoothResize owns the height while it animates
    const h = Math.min(panelInner.scrollHeight, window.innerHeight - 32);
    panel.style.height = h + 'px';
  }
  // ResizeObserver drives panel height frame-by-frame during section toggling.
  // Suppress CSS height transition while sections animate so the RO can drive it directly.
  let sectionAnimating = 0, flipping = false, resizing = false;
  const panelRO = new ResizeObserver(() => {
    if (minimized || flipping || resizing) return;
    if (sectionAnimating > 0) {
      panel.style.transition = 'none';
      resyncHeight();
      panel.offsetHeight;
      panel.style.transition = '';
    } else {
      resyncHeight();
    }
  });
  panelRO.observe(panelInner);
  let openFallback = null;
  function expand() {
    if (!minimized) return;
    originX = computeOrigin(); panel.dataset.originX = originX;
    const targetH = panelInner.offsetHeight;
    panel.classList.remove('minimized');
    // Clip the fixed-width content to the box while it grows in from the dial (see .panel-opening).
    panel.classList.add('panel-opening');
    panel.style.width = PANEL_W + 'px'; panel.style.height = targetH + 'px'; panel.style.borderRadius = '14px';
    layoutExpanded(); minimized = false;
    document.body && (document.body.style.cursor = 'crosshair');   // select mode on
    updateBadges();
    // Restore overflow:visible once the width transition finishes so dropdowns can escape again.
    const onEnd = e => {
      if (e.target !== panel || e.propertyName !== 'width') return;
      panel.classList.remove('panel-opening');
      panel.removeEventListener('transitionend', onEnd);
      clearTimeout(openFallback);
    };
    panel.addEventListener('transitionend', onEnd);
    clearTimeout(openFallback);
    openFallback = setTimeout(() => { panel.classList.remove('panel-opening'); panel.removeEventListener('transitionend', onEnd); }, 600);
  }
  function collapse() {
    if (minimized) return;
    const r = panel.getBoundingClientRect();
    iconX = originX === 'right' ? (r.right - ICON) : r.left; iconY = r.top;
    panel.style.transition = 'none'; panel.style.height = panel.offsetHeight + 'px'; panel.offsetHeight; panel.style.transition = '';
    panel.classList.add('minimized');
    panel.style.width = ICON + 'px'; panel.style.height = ICON + 'px'; panel.style.borderRadius = '50%';
    layoutCollapsed(); minimized = true;
    document.body && (document.body.style.cursor = '');   // release the page
    hideHover(); marquee.style.display = 'none'; updateBadges();
  }

  const DRAG_EXCLUDE = '.icon-btn,.copy-btn,.pick-btn,.ts-slider,.font-picker,.align-btn,.reset-btn,input';
  panel.addEventListener('pointerdown', e => {
    if (e.target.closest(DRAG_EXCLUDE)) return;
    if (!minimized && !e.target.closest('.ph')) return;
    pDrag = true; dragMoved = false; dsx = e.clientX; dsy = e.clientY;
    const r = panel.getBoundingClientRect(); pOx = e.clientX - r.left; pOy = e.clientY - r.top;
    panel.classList.add('panel-dragging'); panel.setPointerCapture(e.pointerId); e.preventDefault();
  });
  panel.addEventListener('pointermove', e => {
    if (!pDrag) return;
    if (Math.hypot(e.clientX - dsx, e.clientY - dsy) > DRAG_THRESHOLD) dragMoved = true;
    const w = panel.offsetWidth, h = panel.offsetHeight;
    panel.style.right = 'auto';
    panel.style.left = clamp(e.clientX - pOx, 0, window.innerWidth - w) + 'px';
    panel.style.top = clamp(e.clientY - pOy, 0, window.innerHeight - h) + 'px';
  });
  panel.addEventListener('pointerup', e => {
    if (!pDrag) return; pDrag = false; panel.classList.remove('panel-dragging');
    if (dragMoved) { suppressClick = true; if (minimized) { iconX = parseFloat(panel.style.left) || 0; iconY = parseFloat(panel.style.top) || 0; } setTimeout(() => suppressClick = false, 0); }
  });
  panel.addEventListener('pointercancel', () => { pDrag = false; panel.classList.remove('panel-dragging'); });
  panel.addEventListener('click', () => { if (suppressClick) return; if (minimized) expand(); });
  minBtn.addEventListener('click', e => { e.stopPropagation(); collapse(); });
  themeBtn.addEventListener('click', e => {
    e.stopPropagation();
    const isLight = panel.classList.toggle('panel-light');
    themeBtn.innerHTML = isLight ? THEME_DARK : THEME_LIGHT;
  });

  let badgesVisible = true;
  const badgeToggleBtn = root.getElementById('badgeToggleBtn');
  badgeToggleBtn.addEventListener('click', e => {
    e.stopPropagation();
    badgesVisible = !badgesVisible;
    badgeToggleBtn.innerHTML = badgesVisible ? EYE_OPEN : EYE_CLOSED;
    badgeNodes.forEach(b => { b.node.style.display = badgesVisible ? '' : 'none'; });
  });

  // Spring physics — ported from motion/react (node_modules/motion/dist/motion.dev.js).
  // Matches DialKit's spring({ visualDuration, bounce }) exactly.
  function springKeyframes(from, to, visualDuration, bounce, steps) {
    steps = steps || 60;
    const mass = 1;
    const dampingRatio = Math.max(0.05, Math.min(1, 1 - bounce));
    // motion's visualDuration→stiffness/damping conversion (line ~1199 of motion.dev.js)
    const root = (2 * Math.PI) / (visualDuration * 1.2);
    const stiffness = root * root;
    const damping = 2 * dampingRatio * Math.sqrt(stiffness * mass);
    // motion's underdamped spring solver (line ~1275 of motion.dev.js)
    const initialDelta = to - from;
    const undampedAngularFreq = Math.sqrt(stiffness / mass) / 1000; // motion uses ms internally
    const angularFreq = undampedAngularFreq * Math.sqrt(1 - dampingRatio * dampingRatio);
    const initialVelocity = 0;
    const A = (initialVelocity + dampingRatio * undampedAngularFreq * initialDelta) / angularFreq;
    const resolveSpring = (t) => {
      const envelope = Math.exp(-dampingRatio * undampedAngularFreq * t);
      return to - envelope * (A * Math.sin(angularFreq * t) + initialDelta * Math.cos(angularFreq * t));
    };
    // Find settle time (when oscillation < 0.5px of target)
    let totalDurMs = visualDuration * 1000 * 2;
    for (let t = totalDurMs; t < 5000; t += 16) {
      if (Math.abs(resolveSpring(t) - to) < 0.5) { totalDurMs = t; break; }
    }
    const frames = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * totalDurMs;
      frames.push(resolveSpring(t));
    }
    frames[frames.length - 1] = to;
    return { frames, duration: totalDurMs };
  }

  // Section collapse/expand — spring animations matching DialKit
  root.querySelectorAll('.section-head[data-sec]').forEach(head => {
    head.addEventListener('click', e => {
      if (e.target.closest('.icon-btn')) return;
      const content = root.getElementById('sec-' + head.dataset.sec);
      const isOpen = !head.classList.contains('collapsed');
      head.classList.toggle('collapsed', isOpen);
      content.getAnimations().forEach(a => { try { a.commitStyles(); } catch(e){} a.cancel(); });

      // Animate chevron with spring { visualDuration: 0.35, bounce: 0.15 }
      const chev = head.querySelector('.section-chev');
      chev.getAnimations().forEach(a => a.cancel());
      const chevFrom = isOpen ? 0 : -180, chevTo = isOpen ? -180 : 0;
      const chevSpring = springKeyframes(chevFrom, chevTo, 0.35, 0.15);
      chev.animate(
        chevSpring.frames.map(v => ({ transform: `rotate(${v}deg)` })),
        { duration: chevSpring.duration, fill: 'forwards' }
      );

      // Animate content with spring { visualDuration: 0.35, bounce: 0.1 }
      sectionAnimating++;
      const done = () => { sectionAnimating = Math.max(0, sectionAnimating - 1); };
      if (isOpen) {
        const h = content.offsetHeight;
        const sp = springKeyframes(h, 0, 0.35, 0.1);
        const anim = content.animate(
          sp.frames.map((v, i) => ({ height: v + 'px', opacity: String(v / h) })),
          { duration: sp.duration }
        );
        anim.onfinish = () => { content.style.height = '0px'; content.style.opacity = '0'; done(); };
        anim.oncancel = done;
      } else {
        content.style.height = 'auto'; content.style.opacity = '1';
        const toH = content.scrollHeight;
        content.style.height = '0px'; content.style.opacity = '0';
        content.offsetHeight;
        const sp = springKeyframes(0, toH, 0.35, 0.1);
        const anim = content.animate(
          sp.frames.map((v, i) => ({ height: v + 'px', opacity: String(Math.min(1, v / (toH * 0.3))) })),
          { duration: sp.duration }
        );
        anim.onfinish = () => { content.style.height = ''; content.style.opacity = ''; done(); };
        anim.oncancel = done;
      }
    });
  });

  // ── Element picking on the host page ──
  // Select-mode is active whenever the panel is EXPANDED. Minimizing to the dial
  // releases the page (clicks pass through) — the minimize button is the on/off.
  const selecting = () => !minimized;
  function boxTo(box, el) {
    if (!el) { box.style.display = 'none'; return; }
    const r = el.getBoundingClientRect();
    box.style.display = 'block'; box.style.left = r.left + 'px'; box.style.top = r.top + 'px';
    box.style.width = r.width + 'px'; box.style.height = r.height + 'px';
  }

  // One outline per selected element — blue for a single, green for a group.
  const selBoxes = [];  // {el, node}
  function updateSelBoxes() {
    while (selBoxes.length < selection.length) { const n = document.createElement('div'); n.className = 'ts-selbox'; root.appendChild(n); selBoxes.push({ el: null, node: n }); }
    while (selBoxes.length > selection.length) { selBoxes.pop().node.remove(); }
    const group = selection.length > 1;
    selection.forEach((el, i) => { selBoxes[i].el = el; selBoxes[i].node.classList.toggle('group', group); boxTo(selBoxes[i].node, el); });
    positionHandles();
  }
  function positionSelBoxes() { selBoxes.forEach(b => { if (b.el) boxTo(b.node, b.el); }); positionHandles(); }

  // ── On-canvas resize: two dots on the single selected element's left/right edge. Both drive
  // max-width (the same state the "Width" slider uses); dragging a dot outward grows the element,
  // inward shrinks it. The element grows per its own alignment — two dots let a right-aligned
  // element grow leftward instead of being trapped against the container edge.
  const handleL = document.createElement('div'); handleL.className = 'ts-handle';
  const handleR = document.createElement('div'); handleR.className = 'ts-handle';
  root.appendChild(handleL); root.appendChild(handleR);
  // "Select the frame around this" button — the visible, discoverable way to climb to the container
  // (Alt/Option-click does the same for those who know it). Rides the top-left of the selection box.
  const FRAME_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V5a1 1 0 0 1 1-1h3"/><path d="M20 8V5a1 1 0 0 0-1-1h-3"/><path d="M4 16v3a1 1 0 0 0 1 1h3"/><path d="M20 16v3a1 1 0 0 1-1 1h-3"/></svg>';
  const frameBtn = document.createElement('div'); frameBtn.className = 'ts-frame'; frameBtn.innerHTML = FRAME_ICON;
  frameBtn.title = 'Select the frame around this (⌥-click too)';
  root.appendChild(frameBtn);
  frameBtn.addEventListener('pointerenter', () => { const par = active && parentPick(active); if (par) { boxTo(hoverBox, par); showLabel(par); } });
  frameBtn.addEventListener('pointerleave', () => hideHover());
  frameBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); const par = active && parentPick(active); if (par) { setSelection([par]); hideHover(); } });
  function positionHandles() {
    const show = !!active && selection.length === 1 && selecting() && !minimized;
    handleL.style.display = handleR.style.display = show ? 'block' : 'none';
    // The frame button uses the same single-selection gate, but only appears when there's a bigger
    // container to climb into (so it never dead-ends).
    const par = show ? parentPick(active) : null;
    frameBtn.style.display = par ? 'flex' : 'none';
    if (!show) return;
    // Keep the dots reachable: for a tall element (e.g. a whole container) the true vertical
    // center can be off-screen, so ride them at the viewport's middle along the element's edges.
    const r = active.getBoundingClientRect(), cy = clamp(r.top + r.height / 2, 24, window.innerHeight - 24);
    handleL.style.left = (r.left - 7) + 'px'; handleL.style.top = (cy - 7) + 'px';
    handleR.style.left = (r.right - 7) + 'px'; handleR.style.top = (cy - 7) + 'px';
    if (par) {
      let ft = r.top - 30; if (ft < 4) ft = Math.min(r.top + 4, window.innerHeight - 28);
      frameBtn.style.left = clamp(r.left - 2, 4, window.innerWidth - 28) + 'px'; frameBtn.style.top = ft + 'px';
    }
  }
  function startResize(e, side) {
    if (!active) return;
    e.preventDefault(); e.stopPropagation();
    canvasBusy = true;
    const el = active, sx = e.clientX, cs = getComputedStyle(el), wp = widthProp(el);
    const w0 = (wp === 'width' || cs.maxWidth === 'none') ? Math.round(parseFloat(cs.width)) : Math.round(parseFloat(cs.maxWidth));
    pushUndo();
    const move = ev => {
      const dx = ev.clientX - sx;
      const w = Math.max(20, Math.round(side === 'r' ? w0 + dx : w0 - dx));   // outward = grow
      el.style[wp] = w + 'px'; trackEdited(el);
      vEl('maxWidth').textContent = w + 'px'; updateRowTrack('maxWidth', w);
      positionSelBoxes();
    };
    const up = () => {
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
      canvasBusy = false; commitMark(); saveCurrentVersion(); updateSelBoxes();
    };
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', up, true);
  }
  handleL.addEventListener('pointerdown', e => startResize(e, 'l'));
  handleR.addEventListener('pointerdown', e => startResize(e, 'r'));

  const inOverlay = e => e.composedPath().includes(hostEl);
  const hasText = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length);
  // agentation-style targeting: only highlight real CONTENT elements. Skip
  // structural tags, elements without their own text (wrappers), and anything
  // that spans nearly the whole page — so hovering a container's padding never
  // washes the whole preview blue.
  const SKIP_TAGS = new Set(['html', 'body', 'head', 'script', 'style', 'noscript', 'link', 'meta', 'svg', 'path', 'br', 'hr']);
  // Media elements are grabbable even without text (photos, video) — this is what lets the photography
  // page's images be selected, dragged, and resized, not just text.
  const MEDIA_TAGS = new Set(['img', 'picture', 'video', 'canvas']);
  const isMedia = el => MEDIA_TAGS.has(el.tagName.toLowerCase());
  // The "Width" control is polymorphic: a photo resizes by its own `width` (so it grows AND shrinks,
  // overriding a responsive width:100%), while a text block resizes by `max-width` (its measure).
  const widthProp = el => isMedia(el) ? 'width' : 'maxWidth';
  // Climb to the FRAME around this element — the nearest ancestor that's meaningfully BIGGER than
  // the current selection (not a same-bounds styling wrapper), so every "expand" visibly moves the
  // outline. Grab a wrapper (e.g. the column) and resize IT — children, incl. width:100% images,
  // reflow: "expand width all at once". Reached by the on-canvas frame button and by Alt/Option-click.
  function parentPick(el) {
    if (!el) return null;
    const r0 = el.getBoundingClientRect();
    let p = el.parentElement;
    while (p && p !== document.body && p !== document.documentElement && p !== hostEl && !hostEl.contains(p)) {
      const r = p.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && !SKIP_TAGS.has(p.tagName.toLowerCase())
          && (r.width - r0.width > 24 || r.height - r0.height > 24)) return p;   // visibly larger only
      p = p.parentElement;
    }
    return null;
  }
  // Plain-English name for a container, by LAYOUT not class names (never show `div.flex`).
  function describeContainer(el) {
    const cs = getComputedStyle(el), tag = el.tagName.toLowerCase();
    if (tag === 'figure') return 'Figure';
    if (tag === 'ul' || tag === 'ol') return 'List';
    const kids = [...el.children];
    const mediaKids = kids.filter(k => isMedia(k) || (k.querySelector && k.querySelector('img,picture,video,canvas')));
    if (cs.display.includes('grid')) return mediaKids.length >= 2 ? 'Gallery' : 'Grid';
    if (cs.display.includes('flex')) return cs.flexDirection.startsWith('row') ? 'Row' : 'Column';
    if (['section', 'article', 'header', 'footer', 'main', 'aside', 'nav'].includes(tag)) return 'Section';
    return kids.length > 1 ? 'Column' : 'Group';
  }
  function pickable(el) {
    if (!el || el === hostEl || hostEl.contains(el)) return false;
    if (el === document.documentElement || el === document.body) return false;
    if (SKIP_TAGS.has(el.tagName.toLowerCase())) return false;
    if (!hasText(el) && !isMedia(el)) return false;             // must carry its own text, OR be media (img/video/…)
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    if (r.width > window.innerWidth * 0.95 && r.height > window.innerHeight * 0.9) return false;  // not a page-sized wrapper
    return true;
  }

  // Human-readable element descriptor — ported from agentation's label logic.
  function describeElement(el) {
    const tag = el.tagName.toLowerCase();
    const text = (el.textContent || '').trim();
    if (/^h[1-6]$/.test(tag)) return text ? `${tag} "${text.slice(0, 35)}"` : tag;
    if (tag === 'p') return text ? `paragraph: "${text.slice(0, 40)}${text.length > 40 ? '...' : ''}"` : 'paragraph';
    if (tag === 'span' || tag === 'label') return (text && text.length < 40) ? `"${text}"` : tag;
    if (tag === 'li') return (text && text.length < 40) ? `list item: "${text.slice(0, 35)}"` : 'list item';
    if (tag === 'a') return text ? `link: "${text.slice(0, 35)}"` : 'link';
    if (tag === 'button') return text ? `button "${text.slice(0, 30)}"` : 'button';
    if (tag === 'blockquote') return 'blockquote';
    if (tag === 'code') return (text && text.length < 30) ? `code: \`${text}\`` : 'code';
    if (tag === 'pre') return 'code block';
    if (tag === 'img') { const alt = el.getAttribute('alt'); return alt ? `image "${alt.slice(0, 30)}"` : 'image'; }
    if (['div', 'section', 'article', 'nav', 'header', 'footer', 'aside', 'main', 'figure', 'ul', 'ol'].includes(tag)) {
      const aria = el.getAttribute('aria-label'); if (aria) return aria;   // human-authored, meaningful
      return describeContainer(el);                                        // Figure / Row / Column / Gallery / Section / List / Group
    }
    return text ? `${tag} "${text.slice(0, 30)}"` : tag;
  }
  function showLabel(el) {
    hoverLabel.textContent = describeElement(el);
    hoverLabel.style.display = 'block';
    const r = el.getBoundingClientRect();
    const lw = hoverLabel.offsetWidth, lh = hoverLabel.offsetHeight;
    let left = clamp(r.left + r.width / 2 - lw / 2, 4, window.innerWidth - lw - 4);
    let top = r.top - lh - 6;
    if (top < 4) top = r.top + 6;   // no room above -> tuck just inside the top
    hoverLabel.style.left = left + 'px'; hoverLabel.style.top = top + 'px';
  }
  const hideHover = () => { hoverBox.style.display = 'none'; hoverLabel.style.display = 'none'; };

  // ── Marks: each edit gets a number; single = blue, group = green (agentation) ──
  let markCounter = 0, currentMark = null;
  function markForSelection() {
    if (selection.length) {                 // reuse if this exact set already forms a mark
      const m = selection[0].__tsMark;
      if (m && m.num != null && m.els.length === selection.length && selection.every(e => e.__tsMark === m)) return m;
    }
    return { num: null, group: selection.length > 1, els: selection.slice() };
  }
  function commitMark() {                    // called when an edit actually changes the selection
    if (!currentMark || !selection.length) return;
    if (currentMark.num == null) currentMark.num = ++markCounter;
    currentMark.group = selection.length > 1;
    currentMark.els = selection.slice();
    selection.forEach(el => el.__tsMark = currentMark);
    maybeAutoCommit();
  }

  let resizeTimer = null;
  // Grow/shrink the panel around a content change with the content CLIPPED during the motion, so
  // expanding is the exact mirror of contracting: the box reveals content top-down instead of the
  // content spilling out the bottom for a frame. (Same clip-and-animate the settings flip uses.)
  function smoothResize(applyChange) {
    if (minimized) { applyChange(); return; }
    const fromH = panel.offsetHeight;
    applyChange();
    const toH = Math.min(panelInner.scrollHeight, window.innerHeight - 32);
    if (Math.abs(toH - fromH) < 1) { resyncHeight(); return; }
    resizing = true;                       // freeze the ResizeObserver
    panelInner.style.overflow = 'hidden';
    panelInner.style.height = '100%';      // fill the panel so content is clipped, not spilled
    panel.style.height = fromH + 'px';     // lock start height
    void panel.offsetWidth;                // reflow so the transition runs
    panel.style.height = toH + 'px';       // animate to target (shared .42s ease-in-out)
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      panelInner.style.overflow = ''; panelInner.style.height = '';
      resizing = false; resyncHeight();
    }, 460);
  }
  function updateHint() {
    phTitle.textContent = selection.length > 1 ? `TypeSet · ${selection.length}` : 'TypeSet';
    const want = selection.length > 0;
    if (want === !controls.classList.contains('disabled')) return;   // controls visibility unchanged
    smoothResize(() => {
      if (want) { selectHint.classList.remove('visible'); controls.classList.remove('disabled'); }
      else { selectHint.classList.add('visible'); controls.classList.add('disabled'); }
    });
  }
  function setSelection(els) {
    selection = els.slice();
    active = selection[selection.length - 1] || null;
    if (active) { const m = new DOMMatrix(getComputedStyle(active).transform); txX = Math.round(m.m41); txY = Math.round(m.m42); syncFrom(active); }
    currentMark = markForSelection();
    updateHint(); updateSelBoxes(); resyncHeight();
  }
  // additive = shift held: toggle this element in/out of the current selection
  function selectEl(el, additive) {
    if (additive) { const i = selection.indexOf(el); if (i >= 0) selection.splice(i, 1); else selection.push(el); setSelection(selection); }
    else setSelection([el]);
  }
  function elementsInRect(l, t, r, b) {
    const hits = [];
    document.body.querySelectorAll('*').forEach(el => {
      if (hostEl.contains(el) || (!hasText(el) && !isMedia(el))) return;
      const rc = el.getBoundingClientRect();
      if (rc.width === 0 || rc.height === 0) return;
      if (rc.left < r && rc.right > l && rc.top < b && rc.bottom > t) hits.push(el);   // AABB overlap (agentation-style)
    });
    return hits;
  }

  // While expanded: a click (no drag) selects one (shift-click toggles into a
  // group); a drag draws a marquee and selects every text element it overlaps.
  let mDown = false, mMoved = false, mx0 = 0, my0 = 0, mShift = false;
  let movePending = false, moveStarted = false, moveStarts = [], canvasBusy = false;
  function onPD(e) {
    if (inOverlay(e) || !selecting() || canvasBusy) return;
    e.preventDefault(); e.stopPropagation();
    mDown = true; mMoved = false; mx0 = e.clientX; my0 = e.clientY; mShift = e.shiftKey;
    // Pressing ANY selected element MAY begin a move-drag of the whole selection — decided on first
    // movement, so a plain click still falls through to normal select (you can drill into children).
    const tgt = e.composedPath()[0];
    movePending = !mShift && !!active && !!tgt && selection.some(el => el === tgt || el.contains(tgt));
    moveStarted = false;
    if (movePending) moveStarts = selection.map(el => { const m = new DOMMatrix(getComputedStyle(el).transform); return { el, x0: Math.round(m.m41), y0: Math.round(m.m42) }; });
  }
  function onPM(e) {
    if (canvasBusy) return;
    if (mDown) {
      if (!mMoved && Math.hypot(e.clientX - mx0, e.clientY - my0) > 6) mMoved = true;
      if (mMoved) {
        if (movePending) {                                   // drag ALL selected elements together (translate)
          if (!moveStarted) { moveStarted = true; pushUndo(); }
          const dx = e.clientX - mx0, dy = e.clientY - my0;
          moveStarts.forEach(o => { o.el.style.transform = `translate(${o.x0 + dx}px,${o.y0 + dy}px)`; trackEdited(o.el); });
          const a = moveStarts.find(o => o.el === active);
          if (a) { txX = a.x0 + dx; txY = a.y0 + dy; vEl('translateX').textContent = txX + 'px'; vEl('translateY').textContent = txY + 'px'; updateRowTrack('translateX', txX); updateRowTrack('translateY', txY); }
          positionSelBoxes(); hideHover();
        } else {
          const l = Math.min(mx0, e.clientX), t = Math.min(my0, e.clientY), r = Math.max(mx0, e.clientX), b = Math.max(my0, e.clientY);
          marquee.style.display = 'block'; marquee.style.left = l + 'px'; marquee.style.top = t + 'px'; marquee.style.width = (r - l) + 'px'; marquee.style.height = (b - t) + 'px';
          hideHover();
        }
      }
      return;
    }
    // Over the on-canvas frame button, let ITS pointerenter drive the container preview — don't let
    // this handler clear it (elementFromPoint resolves to the shadow host, which isn't pickable).
    if (e.composedPath().some(n => n.classList && n.classList.contains('ts-frame'))) return;
    if (selecting()) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (e.altKey) {                        // preview the container Alt-click would grab
        const base = (selection.length === 1 && active && active.contains(el)) ? active : el;
        const par = parentPick(base);
        if (par) { boxTo(hoverBox, par); showLabel(par); } else hideHover();
      }
      else if (pickable(el)) { boxTo(hoverBox, el); showLabel(el); } else hideHover();
    }
  }
  function onPU(e) {
    if (!mDown) return;
    mDown = false; marquee.style.display = 'none';
    if (moveStarted) {                       // finished dragging the element to a new position
      movePending = false; moveStarted = false;
      commitMark(); saveCurrentVersion(); updateSelBoxes(); hideHover(); return;
    }
    movePending = false;
    if (mMoved) {
      const l = Math.min(mx0, e.clientX), t = Math.min(my0, e.clientY), r = Math.max(mx0, e.clientX), b = Math.max(my0, e.clientY);
      const hits = elementsInRect(l, t, r, b);
      if (hits.length) setSelection(mShift ? [...new Set([...selection, ...hits])] : hits);
    } else {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (e.altKey) {                        // Alt/Option-click: climb to the container (repeat to go higher)
        const base = (selection.length === 1 && active && (active === el || active.contains(el))) ? active : el;
        const par = parentPick(base);
        if (par) setSelection([par]);
      }
      else if (pickable(el)) selectEl(el, mShift);
      else if (!mShift) setSelection([]);    // click empty space clears the selection
    }
    hideHover();
  }
  document.addEventListener('pointerdown', onPD, true);
  document.addEventListener('pointermove', onPM, true);
  document.addEventListener('pointerup', onPU, true);
  const onScroll = () => { positionSelBoxes(); positionBadges(); if (selecting()) hideHover(); };
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', () => { positionSelBoxes(); positionBadges(); if (minimized) { iconX = clamp(iconX, 0, innerWidth - ICON); iconY = clamp(iconY, 0, innerHeight - ICON); layoutCollapsed(); } });

  // ── Fonts ──
  const FONTS = [
    { group: 'Sans', name: 'Inter', value: "'Inter', sans-serif" },
    { group: 'Sans', name: 'Plus Jakarta Sans', value: "'Plus Jakarta Sans', sans-serif" },
    { group: 'Sans', name: 'Space Grotesk', value: "'Space Grotesk', sans-serif" },
    { group: 'Sans', name: 'DM Sans', value: "'DM Sans', sans-serif" },
    { group: 'Sans', name: 'Outfit', value: "'Outfit', sans-serif" },
    { group: 'Sans', name: 'System UI', value: "system-ui, sans-serif" },
    { group: 'Serif', name: 'Newsreader', value: "'Newsreader', serif" },
    { group: 'Serif', name: 'DM Serif Display', value: "'DM Serif Display', serif" },
    { group: 'Serif', name: 'Playfair Display', value: "'Playfair Display', serif" },
    { group: 'Serif', name: 'Cormorant Garamond', value: "'Cormorant Garamond', serif" },
    { group: 'Serif', name: 'Lora', value: "'Lora', serif" },
    { group: 'Serif', name: 'Libre Baskerville', value: "'Libre Baskerville', serif" },
    { group: 'Serif', name: 'Georgia', value: "Georgia, serif" },
    { group: 'Mono', name: 'Geist Mono', value: "'Geist Mono', monospace" },
    { group: 'Mono', name: 'Fragment Mono', value: "'Fragment Mono', monospace" },
    { group: 'Mono', name: 'System Mono', value: "ui-monospace, monospace" },
  ];
  function renderFontList() {
    fontList.innerHTML = ['Sans', 'Serif', 'Mono'].map(g => {
      const items = FONTS.filter(f => f.group === g).map(f => {
        const v = f.value.replace(/"/g, '&quot;');
        return `<div class="font-item" data-value="${v}" style="font-family:${v}"><span>${f.name}</span><span class="fi-check">✓</span></div>`;
      }).join('');
      return `<div class="font-group-label">${g}</div>${items}`;
    }).join('');
    fontList.querySelectorAll('.font-item').forEach(item => item.addEventListener('click', () => {
      const val = item.dataset.value;
      if (selection.length) { pushUndo(); selection.forEach(el => { el.style.fontFamily = val; trackEdited(el); }); commitMark(); saveCurrentVersion(); setFontUI(val); updateSelBoxes(); }
      closeFontList();
    }));
  }
  function setFontUI(fam) {
    const clean = (fam || '').replace(/['"]/g, '');
    let match = null;
    for (const f of FONTS) { const key = f.value.replace(/'/g, '').split(',')[0].trim(); if (clean.includes(key)) { match = f; break; } }
    const chosen = match || { name: (clean.split(',')[0] || '—').trim(), value: fam };
    fontTriggerName.textContent = chosen.name; fontTriggerName.style.fontFamily = chosen.value;
    fontList.querySelectorAll('.font-item').forEach(it => it.classList.toggle('current', !!match && it.dataset.value === chosen.value));
  }
  function closeFontList() { if (fontPicker.classList.contains('open')) { fontPicker.classList.remove('open'); resyncHeight(); } }
  fontTrigger.addEventListener('click', e => { e.stopPropagation(); fontPicker.classList.toggle('open'); resyncHeight(); });
  root.addEventListener('click', e => { if (!e.target.closest('#fontPicker')) closeFontList(); });
  renderFontList();

  // ── Sync / apply (element-agnostic) ──
  function updateRowTrack(prop, val) {
    const s = root.querySelector(`.ts-slider[data-prop="${prop}"]`); if (!s) return;
    const min = parseFloat(s.dataset.min), max = parseFloat(s.dataset.max);
    const pct = clamp(((val - min) / (max - min)) * 100, 0, 100);
    s.dataset.pct = pct; s.querySelector('.ts-slider-fill').style.width = pct.toFixed(2) + '%';
    updateHandle(s);
  }
  function updateHandle(s) {
    const handle = s.querySelector('.ts-slider-handle'), labelEl = s.querySelector('.ts-slider-label'), valEl = s.querySelector('.ts-slider-value');
    const w = s.offsetWidth || 240, pct = parseFloat(s.dataset.pct) || 0;
    handle.style.left = clamp((pct / 100) * w - 1.5, 2, w - 4) + 'px';
    const leftT = ((10 + (labelEl.offsetWidth || 30) + 8) / w) * 100;
    const rightT = ((w - 10 - (valEl.offsetWidth || 30) - 8) / w) * 100;
    const dodge = pct < leftT || pct > rightT;
    const on = s.classList.contains('active'), drag = s.classList.contains('dragging');
    let o = 0, sx = 0.25, sy = 1;
    if (on) { sx = 1; if (dodge) { o = 0.12; sy = 0.75; } else if (drag) o = 0.9; else o = 0.5; }
    handle.style.opacity = o; handle.style.transform = `translateY(-50%) scaleX(${sx}) scaleY(${sy})`;
  }
  function fmt(prop, v) {
    if (prop === 'fontSize') return Math.round(v) + 'px';
    if (prop === 'fontWeight') return Math.round(v);
    if (prop === 'lineHeight') return (+v).toFixed(2);
    if (prop === 'letterSpacing') return (+v).toFixed(3) + 'em';
    if (prop === 'opacity') return Math.round(v) + '%';
    return Math.round(v) + 'px';
  }
  const vEl = prop => root.querySelector(`.ts-slider-value[data-v="${prop}"]`);
  function syncFrom(el) {
    const cs = getComputedStyle(el), fsz = parseFloat(cs.fontSize);
    const lh = isNaN(parseFloat(cs.lineHeight) / fsz) ? 1.4 : Math.round((parseFloat(cs.lineHeight) / fsz) * 100) / 100;
    const lsPx = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing);
    const ls = Math.round((lsPx / fsz) * 1000) / 1000;
    const mat = new DOMMatrix(cs.transform); txX = Math.round(mat.m41); txY = Math.round(mat.m42);
    const wid = widthProp(el) === 'width' ? Math.round(parseFloat(cs.width)) : (cs.maxWidth === 'none' ? Math.round(parseFloat(cs.width)) : Math.round(parseFloat(cs.maxWidth)));
    vEl('fontSize').textContent = Math.round(fsz) + 'px';
    vEl('fontWeight').textContent = parseInt(cs.fontWeight) || 400;
    vEl('lineHeight').textContent = lh.toFixed(2);
    vEl('letterSpacing').textContent = ls.toFixed(3) + 'em';
    vEl('translateX').textContent = txX + 'px';
    vEl('translateY').textContent = txY + 'px';
    vEl('maxWidth').textContent = wid + 'px';
    updateRowTrack('fontSize', fsz); updateRowTrack('fontWeight', parseInt(cs.fontWeight) || 400);
    updateRowTrack('lineHeight', lh); updateRowTrack('letterSpacing', ls);
    updateRowTrack('translateX', txX); updateRowTrack('translateY', txY);
    const pad = Math.round(parseFloat(cs.paddingTop)) || 0;
    const rad = Math.round(parseFloat(cs.borderRadius)) || 0;
    const mt = Math.round(parseFloat(cs.marginTop)) || 0;
    updateRowTrack('maxWidth', wid);
    vEl('padding').textContent = pad + 'px';
    vEl('borderRadius').textContent = rad + 'px';
    vEl('marginTop').textContent = mt + 'px';
    const opa = Math.round((parseFloat(cs.opacity) || 1) * 100);
    updateRowTrack('padding', pad); updateRowTrack('borderRadius', rad); updateRowTrack('marginTop', mt);
    vEl('opacity').textContent = opa + '%';
    updateRowTrack('opacity', opa);
    setFontUI(cs.fontFamily);
    root.querySelectorAll('.style-btn').forEach(b => {
      const st = b.dataset.style;
      if (st === 'italic') b.classList.toggle('active', cs.fontStyle === 'italic');
      else if (st === 'bold') b.classList.toggle('active', parseInt(cs.fontWeight) >= 700);
      else if (st === 'underline') b.classList.toggle('active', cs.textDecoration.includes('underline'));
    });
    root.querySelectorAll('.align-btn').forEach(b => b.classList.toggle('active', b.dataset.align === cs.textAlign));
  }
  function getCurrentValue(prop) {
    if (!active) return 0;
    const cs = getComputedStyle(active), fsz = parseFloat(cs.fontSize);
    if (prop === 'fontSize') return fsz;
    if (prop === 'fontWeight') return parseInt(cs.fontWeight) || 400;
    if (prop === 'lineHeight') return Math.round((parseFloat(cs.lineHeight) / fsz) * 100) / 100;
    if (prop === 'letterSpacing') return Math.round(((cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing)) / fsz) * 1000) / 1000;
    if (prop === 'translateX') return txX;
    if (prop === 'translateY') return txY;
    if (prop === 'maxWidth') return widthProp(active) === 'width' ? Math.round(parseFloat(cs.width)) : (cs.maxWidth === 'none' ? Math.round(parseFloat(cs.width)) : Math.round(parseFloat(cs.maxWidth)));
    if (prop === 'padding') return Math.round(parseFloat(cs.paddingTop)) || 0;
    if (prop === 'marginTop') return Math.round(parseFloat(cs.marginTop)) || 0;
    if (prop === 'borderRadius') return Math.round(parseFloat(cs.borderRadius)) || 0;
    if (prop === 'opacity') return Math.round((parseFloat(cs.opacity) || 1) * 100);
    return 0;
  }
  function applyProp(prop, val) {
    if (!selection.length) return;
    if (prop === 'translateX') txX = val;
    if (prop === 'translateY') txY = val;
    selection.forEach(el => {
      const s = el.style;
      if (prop === 'fontSize') s.fontSize = val + 'px';
      else if (prop === 'fontWeight') s.fontWeight = val;
      else if (prop === 'lineHeight') s.lineHeight = val;
      else if (prop === 'letterSpacing') s.letterSpacing = val + 'em';
      else if (prop === 'maxWidth') s[widthProp(el)] = val + 'px';
      else if (prop === 'padding') s.padding = val + 'px';
      else if (prop === 'marginTop') s.marginTop = val + 'px';
      else if (prop === 'borderRadius') s.borderRadius = val + 'px';
      else if (prop === 'opacity') s.opacity = val / 100;
      else if (prop === 'translateX' || prop === 'translateY') s.transform = `translate(${txX}px,${txY}px)`;
      trackEdited(el);
    });
    commitMark();
    updateRowTrack(prop, val); saveCurrentVersion(); updateSelBoxes();
  }

  // ── Sliders ──
  const decimalsForStep = step => { const s = step.toString(), d = s.indexOf('.'); return d === -1 ? 0 : s.length - d - 1; };
  function setupSlider(s) {
    const prop = s.dataset.prop, min = parseFloat(s.dataset.min), max = parseFloat(s.dataset.max), step = parseFloat(s.dataset.step);
    const valEl = s.querySelector('.ts-slider-value'), input = s.querySelector('.ts-slider-input'), dec = decimalsForStep(step);
    const hashContainer = s.querySelector('.ts-slider-hashmarks');
    const discreteSteps = (max - min) / step;
    const marks = discreteSteps <= 10
      ? Array.from({ length: Math.max(discreteSteps - 1, 0) }, (_, i) => ((i + 1) * step / (max - min)) * 100)
      : Array.from({ length: 9 }, (_, i) => (i + 1) * 10);
    marks.forEach(left => { const d = document.createElement('div'); d.className = 'ts-slider-hashmark'; d.style.left = left + '%'; hashContainer.appendChild(d); });
    const DEAD = 32, MAXS = 8, RANGE = 200;
    let interacting = false, clickFlag = true, dx = 0, dy = 0, rect = null, editable = false, hoverTimer = null;
    const roundV = v => parseFloat((Math.round(v / step) * step).toFixed(dec));
    const posToVal = x => clamp(min + clamp((x - rect.left) / (s.offsetWidth || 1), 0, 1) * (max - min), min, max);
    const snapDecile = raw => { const n = (raw - min) / (max - min), near = Math.round(n * 10) / 10; return Math.abs(n - near) <= 0.03125 ? min + near * (max - min) : raw; };
    function commit(v) { if (!active) return; v = clamp(roundV(v), min, max); pushUndo0(); applyProp(prop, v); valEl.textContent = fmt(prop, v); }
    let undoOnce = false; function pushUndo0() { if (!undoOnce) { undoOnce = true; } }
    function rubber(x) {
      let st = 0;
      if (x < rect.left) { const o = Math.max(0, (rect.left - x) - DEAD); st = -MAXS * Math.sqrt(Math.min(o / RANGE, 1)); }
      else if (x > rect.right) { const o = Math.max(0, (x - rect.right) - DEAD); st = MAXS * Math.sqrt(Math.min(o / RANGE, 1)); }
      s.classList.remove('snapping'); s.style.width = `calc(100% + ${Math.abs(st)}px)`; s.style.transform = `translateX(${st < 0 ? st : 0}px)`;
    }
    const release = () => { s.classList.add('snapping'); s.style.width = ''; s.style.transform = ''; };
    s.addEventListener('pointerdown', e => {
      if (!active) return; if (e.target === valEl && editable) return;
      e.preventDefault(); e.stopPropagation(); s.setPointerCapture(e.pointerId);
      dx = e.clientX; dy = e.clientY; clickFlag = true; interacting = true; undoOnce = false;
      rect = s.getBoundingClientRect(); s.classList.add('active'); updateHandle(s); pushUndo();
    });
    s.addEventListener('pointermove', e => {
      if (interacting && active) {
        if (clickFlag && Math.hypot(e.clientX - dx, e.clientY - dy) > 3) { clickFlag = false; s.classList.add('dragging'); }
        if (!clickFlag) { rubber(e.clientX); commit(posToVal(e.clientX)); }
      }
    });
    s.addEventListener('pointerup', e => {
      if (!interacting) return;
      if (clickFlag) { const raw = posToVal(e.clientX); const steps = (max - min) / step; commit(steps <= 10 ? clamp(min + Math.round((raw - min) / step) * step, min, max) : snapDecile(raw)); }
      release(); interacting = false; s.classList.remove('dragging'); updateHandle(s);
    });
    s.addEventListener('pointercancel', () => { interacting = false; s.classList.remove('dragging'); release(); updateHandle(s); });
    s.addEventListener('mouseenter', () => { s.classList.add('active'); updateHandle(s); });
    s.addEventListener('mouseleave', () => { if (!interacting) { s.classList.remove('active'); updateHandle(s); } });
    valEl.addEventListener('mouseenter', () => { hoverTimer = setTimeout(() => { editable = true; valEl.classList.add('editable'); }, 800); });
    valEl.addEventListener('mouseleave', () => { clearTimeout(hoverTimer); if (input.style.display === 'none' || !input.style.display) { editable = false; valEl.classList.remove('editable'); } });
    valEl.addEventListener('click', e => { if (!editable || !active) return; e.stopPropagation(); input.value = getCurrentValue(prop); valEl.style.display = 'none'; input.style.display = 'block'; input.focus(); input.select(); });
    const commitInput = () => { const v = parseFloat(input.value); if (!isNaN(v)) { pushUndo(); commit(v); } input.style.display = 'none'; valEl.style.display = ''; editable = false; valEl.classList.remove('editable'); };
    input.addEventListener('blur', commitInput);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') commitInput(); if (e.key === 'Escape') { input.style.display = 'none'; valEl.style.display = ''; } });
    input.addEventListener('pointerdown', e => e.stopPropagation());
  }
  root.querySelectorAll('.ts-slider').forEach(setupSlider);

  root.querySelectorAll('.align-btn').forEach(btn => btn.addEventListener('click', () => {
    root.querySelectorAll('.align-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (selection.length) { pushUndo(); selection.forEach(el => { el.style.textAlign = btn.dataset.align; trackEdited(el); }); commitMark(); saveCurrentVersion(); updateSelBoxes(); }
  }));
  root.querySelectorAll('.style-btn').forEach(btn => btn.addEventListener('click', () => {
    if (!selection.length) return;
    const st = btn.dataset.style;
    const isOn = btn.classList.contains('active');
    pushUndo();
    selection.forEach(el => {
      if (st === 'italic') el.style.fontStyle = isOn ? '' : 'italic';
      else if (st === 'bold') el.style.fontWeight = isOn ? '' : '700';
      else if (st === 'underline') el.style.textDecoration = isOn ? '' : 'underline';
      trackEdited(el);
    });
    btn.classList.toggle('active');
    commitMark(); saveCurrentVersion(); updateSelBoxes();
    if (active) syncFrom(active);
  }));
  resetBtn.addEventListener('click', () => {
    if (!selection.length) return; pushUndo();
    const props = ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'fontFamily', 'textAlign', 'transform', 'maxWidth', 'width', 'marginTop', 'padding', 'borderRadius', 'opacity', 'fontStyle', 'textDecoration'];
    selection.forEach(el => { props.forEach(p => el.style[p] = ''); el.__tsMark = null; });
    txX = 0; txY = 0; if (active) syncFrom(active); saveCurrentVersion(); updateSelBoxes();
  });

  // ── Copy CSS as selector blocks ──
  function cssSelector(el) {
    if (el.id) return '#' + CSS_escape(el.id);
    let sel = el.tagName.toLowerCase();
    const cls = [...el.classList].filter(c => !c.startsWith('typeset')).slice(0, 2);
    if (cls.length) sel += '.' + cls.map(CSS_escape).join('.');
    const p = el.parentElement;
    if (p && !el.id) { const same = [...p.children].filter(c => c.tagName === el.tagName); if (same.length > 1) sel += `:nth-of-type(${same.indexOf(el) + 1})`; }
    return sel;
  }
  const CSS_escape = s => (window.CSS && CSS.escape) ? CSS.escape(s) : s.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  const MCP_PORT = 8800;
  // Routing token: which project/chat owns changes from this page. The agent bakes it into
  // the script tag as data-project (its pwd); falls back to the page origin if absent.
  const TS_PROJECT = (function () {
    const s = document.currentScript || document.querySelector('script[src*="typeset-overlay"]');
    return (s && s.getAttribute('data-project')) || location.origin;
  })();
  const PROP_MAP = [
    ['fontFamily', 'font-family'], ['fontSize', 'font-size'], ['fontWeight', 'font-weight'],
    ['lineHeight', 'line-height'], ['letterSpacing', 'letter-spacing'], ['textAlign', 'text-align'],
    ['maxWidth', 'max-width'], ['width', 'width'], ['padding', 'padding'], ['marginTop', 'margin-top'], ['borderRadius', 'border-radius'],
    ['opacity', 'opacity'], ['fontStyle', 'font-style'], ['textDecoration', 'text-decoration'],
  ];
  // Collect the current edited state: blocks (for the clipboard) + mcpChanges (for the agent).
  function collectChanges() {
    const blocks = [], mcpChanges = [];
    edited.forEach(el => {
      const s = el.style, sel = cssSelector(el), cs = getComputedStyle(el);
      const lines = [
        s.fontFamily && `font-family: ${s.fontFamily};`,
        s.fontSize && `font-size: ${s.fontSize};`,
        s.fontWeight && `font-weight: ${s.fontWeight};`,
        s.lineHeight && `line-height: ${s.lineHeight};`,
        s.letterSpacing && `letter-spacing: ${s.letterSpacing};`,
        s.textAlign && `text-align: ${s.textAlign};`,
        s.maxWidth && `max-width: ${s.maxWidth};`,
        s.width && `width: ${s.width};`,
        s.padding && `padding: ${s.padding};`,
        s.marginTop && `margin-top: ${s.marginTop};`,
        s.borderRadius && `border-radius: ${s.borderRadius};`,
        s.opacity && `opacity: ${s.opacity};`,
        s.fontStyle && `font-style: ${s.fontStyle};`,
        s.textDecoration && `text-decoration: ${s.textDecoration};`,
        s.transform && s.transform !== 'none' && `transform: ${s.transform};`,
      ].filter(Boolean);
      if (lines.length) blocks.push(`${sel} {\n  ${lines.join('\n  ')}\n}`);
      PROP_MAP.forEach(([js, css]) => {
        // Queue every property the user set inline (exactly what they scrubbed). The daemon
        // dedups by selector+property+project, so re-committing full state (watch mode) is safe.
        if (s[js]) mcpChanges.push({ selector: sel, property: css, value: s[js], previousValue: cs[js] || null, project: TS_PROJECT });
      });
      // Position (drag or X/Y sliders) writes `transform`; queue it too so on-canvas moves persist
      // to source like every other prop. Daemon dedups by selector+property+project.
      if (s.transform && s.transform !== 'none')
        mcpChanges.push({ selector: sel, property: 'transform', value: s.transform, previousValue: cs.transform || null, project: TS_PROJECT });
    });
    return { blocks, mcpChanges };
  }

  function postChanges(mcpChanges) {
    if (!mcpChanges.length) return;
    fetch(`http://127.0.0.1:${MCP_PORT}/commit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mcpChanges),
    }).catch(() => {});
  }

  function triggerCopy() {
    const { blocks, mcpChanges } = collectChanges();
    if (!blocks.length) return;
    navigator.clipboard.writeText('/* TypeSet — ' + versions[currentVersionIdx].name + ' */\n\n' + blocks.join('\n\n')).then(() => {
      const orig = copyBtn.innerHTML;
      copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12.75L10 19L19 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      copyBtn.classList.add('copied');
      setTimeout(() => { copyBtn.innerHTML = orig; copyBtn.classList.remove('copied'); }, 1500);
    });
    postChanges(mcpChanges);
  }
  copyBtn.addEventListener('click', triggerCopy);

  // --- Watch mode: stream edits to the agent live (pairs with the agent's watch_typeset_changes loop) ---
  let watchMode = false;   // always OFF at launch — never auto-restored from localStorage; the user turns it on deliberately each session
  let watchTimer = null;
  function commitNow() { postChanges(collectChanges().mcpChanges); }
  // Called from commitMark on every edit; debounced so a continuous scrub commits once when it settles.
  function maybeAutoCommit() {
    if (!watchMode) return;
    clearTimeout(watchTimer);
    watchTimer = setTimeout(commitNow, 350);
  }
  function renderWatch() {
    watchBtn.classList.toggle('watching', watchMode);
    watchBtn.title = watchMode
      ? 'Watch ON — every edit auto-sends to your agent as you scrub. Click to stop.'
      : 'Watch: auto-send every edit to your agent as you scrub — no Copy needed. Click to start.';
    copyBtn.style.display = watchMode ? 'none' : '';
  }
  // ── D3: agent-watching indicator. The daemon reports whether a chat session is actively in its
  // watch loop for this project (the MCP server heartbeats while watch_typeset_changes blocks). When
  // Watch is ON but no agent is listening, edits pile up silently — so surface a visible "send a
  // message in your chat" cue. Polled only while Watch is on.
  const noWatch = $('noWatch');
  const WATCH_PHRASE = 'watch my TypeSet edits';
  const noWatchCopy = $('noWatchCopy'), noWatchIcon = $('noWatchIcon');
  const COPY_ICON_HTML = noWatchIcon.innerHTML;
  const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 12.75L10 19L19 5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  noWatchCopy.addEventListener('click', e => {
    e.stopPropagation();
    navigator.clipboard.writeText(WATCH_PHRASE).then(() => {
      noWatchIcon.innerHTML = CHECK_SVG; noWatchCopy.title = 'Copied';
      setTimeout(() => { noWatchIcon.innerHTML = COPY_ICON_HTML; noWatchCopy.title = 'Copy'; }, 1400);
    }).catch(() => {});
  });
  let agentWatching = false, watchPollTimer = null;
  // Watch is off by default and turned on deliberately, so showing the pairing prompt the moment it's
  // on (and no agent is applying) is the right teachable beat — not a premature nag on a fresh page.
  const liveMsg = $('liveMsg');
  function renderNoWatch() {
    noWatch.classList.toggle('visible', watchMode && !agentWatching);   // blue "paste this" — not synced
    liveMsg.classList.toggle('visible', watchMode && agentWatching);    // green "Live" — synced
  }
  function pollWatching() {
    fetch(`http://127.0.0.1:${MCP_PORT}/watching?project=${encodeURIComponent(TS_PROJECT)}`)
      .then(r => r.json()).then(j => { agentWatching = !!j.watching; renderNoWatch(); })
      .catch(() => { agentWatching = false; renderNoWatch(); });
  }
  function setWatchPolling(on) {
    clearInterval(watchPollTimer);
    if (on) { pollWatching(); watchPollTimer = setInterval(pollWatching, 3000); }
    else { agentWatching = false; renderNoWatch(); }
  }
  watchBtn.addEventListener('click', () => {
    watchMode = !watchMode;
    renderWatch();
    setWatchPolling(watchMode);
    if (watchMode) commitNow();
  });
  renderWatch();
  setWatchPolling(watchMode);

  // ── Settings panel: the header gear flips the pane to a back face. It rotates the pane to
  // its vertical edge, swaps faces there (invisible), then rotates the new face in. Driven by
  // transitionend (not a timer) so the swap lands exactly at the 90° edge; the pane stays on a
  // stable will-change layer at a resting rotateY(0), so the icons don't shimmer or flash.
  const flip = $('flip'), frontFace = $('frontFace'), settingsFace = $('settingsFace');
  const settingsBtn = $('settingsBtn'), settingsBack = $('settingsBack');
  const badgeBtn = root.getElementById('badgeToggleBtn');
  // Two-face card flip: both faces show only during the rotation (backface-visibility hides the one
  // facing away — no blank-white window). The whole panel's HEIGHT animates in lockstep with the
  // rotation via #panel's own .34s height transition: lock the current height, then set the target
  // (header + incoming face). panel-inner fills the panel (height:100%, overflow hidden) so the tall
  // scrubber is clipped rather than spilling as the panel shrinks, and the ResizeObserver is frozen
  // so it can't reset the height mid-flip. Afterwards the hidden face leaves layout and resyncHeight
  // settles the exact final height.
  let onSettings = false, flipTimer = null;
  function doFlip(toBack) {
    if (toBack === onSettings) return;
    onSettings = toBack;
    frontFace.style.display = 'block'; settingsFace.style.display = 'block'; // both present to rotate
    if (toBack) refreshSettings();
    const target = (toBack ? settingsFace : frontFace).scrollHeight;
    const overhead = panelInner.scrollHeight - frontFace.scrollHeight;       // header + paddings
    const toH = Math.min(overhead + target, window.innerHeight - 32);
    flipping = true;                                 // freeze the ResizeObserver
    panelInner.style.overflow = 'hidden';
    panelInner.style.height = '100%';                // clip so the tall scrubber can't spill mid-shrink
    flip.style.height = flip.offsetHeight + 'px';    // lock heights
    panel.style.height = panel.offsetHeight + 'px';
    void panel.offsetWidth;                          // reflow so all transitions start together
    flip.classList.toggle('flipped', toBack);        // rotate (.38s)
    flip.style.height = target + 'px';               // flip content area → incoming face (sizes it)
    panel.style.height = toH + 'px';                 // panel box → target, concurrent with the flip (.34s)
    clearTimeout(flipTimer);
    flipTimer = setTimeout(() => {
      if (onSettings) frontFace.style.display = 'none';                       // keep flip sized to Settings
      else { settingsFace.style.display = 'none'; flip.style.height = ''; }   // scrubber back, auto height
      panelInner.style.overflow = ''; panelInner.style.height = '';
      flipping = false;
      resyncHeight();                                // settle to the exact final height
    }, 430);
  }
  settingsBtn.addEventListener('click', e => { e.stopPropagation(); doFlip(!onSettings); });
  settingsBack.addEventListener('click', e => { e.stopPropagation(); doFlip(false); });

  // Tips = the hover tooltips on the toolbar buttons, behind a single toggle.
  const swTips = $('setTips');
  const setSw = (el, on) => el.setAttribute('aria-checked', on ? 'true' : 'false');
  const swOn = el => el.getAttribute('aria-checked') === 'true';
  const tipEls = [copyBtn, watchBtn, badgeBtn, themeBtn, settingsBtn, minBtn];
  const origTitles = new WeakMap();
  tipEls.forEach(el => origTitles.set(el, el.getAttribute('title') || ''));
  function applyTooltips(on) {
    tipEls.forEach(el => { if (on) { const t = origTitles.get(el); if (t) el.setAttribute('title', t); } else el.removeAttribute('title'); });
  }
  let tipsOn = localStorage.getItem('ts-tips') !== '0';
  applyTooltips(tipsOn);
  function setTips(on) {
    tipsOn = on;
    localStorage.setItem('ts-tips', on ? '1' : '0');
    applyTooltips(on);
    setSw(swTips, on);
  }
  swTips.addEventListener('click', () => setTips(!swOn(swTips)));

  function refreshSettings() {
    setSw(swTips, tipsOn);
    const p = $('setProject'); p.textContent = TS_PROJECT; p.title = TS_PROJECT;
    const d = $('setDaemon'); d.textContent = 'Checking…'; d.className = 'set-val';
    fetch(`http://127.0.0.1:${MCP_PORT}/health`)
      .then(r => r.json())
      .then(j => { d.textContent = j.pending ? `Connected · ${j.pending} pending` : 'Connected'; d.className = 'set-val ok'; })
      .catch(() => { d.textContent = 'Not running'; d.className = 'set-val bad'; });
    const a = $('setAgent'); a.textContent = 'Checking…'; a.className = 'set-val';
    fetch(`http://127.0.0.1:${MCP_PORT}/watching?project=${encodeURIComponent(TS_PROJECT)}`)
      .then(r => r.json())
      .then(j => { a.textContent = j.watching ? 'Watching' : 'Not watching'; a.className = j.watching ? 'set-val ok' : 'set-val bad'; })
      .catch(() => { a.textContent = 'Not watching'; a.className = 'set-val bad'; });
  }

  // ── Keyboard ──
  function onKey(e) {
    if (e.key === 'Escape' && selection.length) { setSelection([]); return; }
    // Arrow keys nudge the single selected element (transform): 1px, or 10px with Shift.
    if (active && selection.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey && selecting() &&
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      const ae = root.activeElement, de = document.activeElement;   // don't hijack arrows while typing in a field
      if ((ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName)) || (de && /^(INPUT|TEXTAREA)$/.test(de.tagName))) return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const m = new DOMMatrix(getComputedStyle(active).transform); txX = Math.round(m.m41); txY = Math.round(m.m42);
      if (e.key === 'ArrowLeft') txX -= step; else if (e.key === 'ArrowRight') txX += step;
      else if (e.key === 'ArrowUp') txY -= step; else txY += step;
      active.style.transform = `translate(${txX}px,${txY}px)`; trackEdited(active);
      vEl('translateX').textContent = txX + 'px'; vEl('translateY').textContent = txY + 'px';
      updateRowTrack('translateX', txX); updateRowTrack('translateY', txY);
      commitMark(); saveCurrentVersion(); positionSelBoxes();
      return;
    }
    if (!e.metaKey && !e.ctrlKey) return;
    if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); popUndo(); }
    else if (e.key === 'c' && active && !window.getSelection().toString()) { e.preventDefault(); triggerCopy(); }
  }
  document.addEventListener('keydown', onKey, true);

  // ── Init: render minimized (dial icon), top-right, light mode ──
  (function init() {
    originX = 'right'; panel.dataset.originX = 'right';
    panel.classList.add('panel-light');
    iconX = window.innerWidth - ICON - 20; iconY = 20;
    panel.style.transition = 'none';
    panel.classList.add('minimized'); minimized = true;
    panel.style.width = ICON + 'px'; panel.style.height = ICON + 'px'; panel.style.borderRadius = '50%';
    panel.style.right = 'auto'; panel.style.left = iconX + 'px'; panel.style.top = iconY + 'px';
    panel.offsetHeight; panel.style.transition = '';
    renderVersionMenu();
  })();

  // ── Teardown (re-run script to toggle off) ──
  window.__typesetOverlay = {
    destroy() {
      document.removeEventListener('pointerdown', onPD, true);
      document.removeEventListener('pointermove', onPM, true);
      document.removeEventListener('pointerup', onPU, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
      if (document.body) document.body.style.cursor = '';
      hostEl.remove();
      delete window.__typesetOverlay;
    }
  };
})();
