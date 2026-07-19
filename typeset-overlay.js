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
 */
(function () {
  'use strict';

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
      --text-mid:rgba(255,255,255,0.7); --text-lo:rgba(255,255,255,0.4); --hint-col:rgba(255,255,255,0.7);
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
      transition:width .34s cubic-bezier(.32,.72,0,1),height .34s cubic-bezier(.32,.72,0,1),
        left .34s cubic-bezier(.32,.72,0,1),top .34s cubic-bezier(.32,.72,0,1),
        border-radius .3s cubic-bezier(.32,.72,0,1),background .2s ease,box-shadow .28s ease;
    }
    #panel.panel-dragging { transition:none; }
    .panel-inner { width:260px; opacity:1; transition:opacity .16s ease; padding:10px 12px 0; }

    #panel.panel-light {
      --bg:#fafafa; --bg-hover:rgba(0,0,0,0.08); --border:rgba(0,0,0,0.1); --border-sub:rgba(0,0,0,0.06);
      --text-hi:rgba(0,0,0,0.9); --text-mid:rgba(0,0,0,0.6); --text-lo:rgba(0,0,0,0.35); --text-val:rgba(0,0,0,0.6); --hint-col:rgba(0,0,0,0.6);
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
      opacity:0; transition:opacity .14s ease; pointer-events:none; color:var(--dial-icon);
      font-family:'DM Serif Display','Playfair Display',Georgia,serif; font-size:19px; font-weight:400; line-height:1; }
    #panel.minimized .dial-icon { opacity:1; }

    .ph { display:flex; align-items:center; justify-content:space-between; padding:12px 0 6px; cursor:grab; margin-bottom:12px; border-bottom:1px solid var(--border-sub); }
    .ph:active { cursor:grabbing; }
    .ph-title { font-size:15px; font-weight:600; color:var(--text-hi); letter-spacing:-0.01em; }
    .ph-right { display:flex; align-items:center; gap:5px; }
    .icon-btn { width:22px; height:22px; display:flex; align-items:center; justify-content:center; border:none; background:none; cursor:pointer; border-radius:6px; color:var(--icon-col); transition:color .12s,background .12s; }
    .icon-btn:hover { background:var(--bg-hover); color:var(--text-hi); }
    .tb-btn.copied { color:var(--text-mid); }
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

    .pb { overflow-y:auto; max-height:calc(100vh - 160px); position:relative; }
    .select-hint { font-size:13px; color:var(--hint-col); text-align:center; letter-spacing:0.02em; display:none; }
    .select-hint.visible { display:block; position:absolute; left:0; right:0; top:50%; transform:translateY(-50%); padding:0 12px; z-index:5; }
    .section-head { display:flex; align-items:center; justify-content:space-between; height:44px; padding:0; border-top:1px solid var(--border-sub); }
    .section-head:first-child { border-top:none; }
    .section-head span { font-size:15px; font-weight:600; line-height:20px; color:var(--text-hi); letter-spacing:-0.01em; }
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
    #controls { display:flex; flex-direction:column; gap:6px; transition:opacity .15s; }
    #controls.disabled { opacity:0.22; pointer-events:none; }
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
    .font-list { display:none; margin-top:5px; max-height:232px; overflow-y:auto; background:var(--bg); border:1px solid var(--border); border-radius:var(--radius); padding:4px; box-shadow:0 8px 24px rgba(0,0,0,0.4); }
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
    /* dark pill descriptor label (agentation hover tooltip) */
    .ts-label { position:fixed; display:none; z-index:2147483647; pointer-events:none;
      font:500 11px/1.3 system-ui,-apple-system,sans-serif; color:#fff; background:rgba(0,0,0,0.85);
      padding:4px 8px; border-radius:6px; max-width:340px; white-space:nowrap; overflow:hidden;
      text-overflow:ellipsis; box-shadow:0 2px 10px rgba(0,0,0,0.35); }
  `;

  const COPY ='<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M8 6C8 4.343 9.343 3 11 3h2c1.657 0 3 1.343 3 3v1H8V6z" stroke="currentColor" stroke-width="1.5"/><path d="M16 5h1c1.657 0 3 1.343 3 3v3M8 5H7c-1.657 0-3 1.343-3 3v10c0 1.657 1.343 3 3 3h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M19.24 16.19l-.7-1.81a.5.5 0 00-.93 0l-.7 1.81a1.5 1.5 0 01-.87.88l-1.81.7a.5.5 0 000 .93l1.81.7c.26.1.47.32.57.57l.7 1.81a.5.5 0 00.93 0l.7-1.81c.1-.26.32-.47.57-.57l1.81-.7a.5.5 0 000-.93l-1.81-.7a1.5 1.5 0 01-.57-.57z" fill="currentColor"/></svg>';
  const ADDV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h6M15 15h6M18 12v6M4 18h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  const THEME = '<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" stroke-width="1"/><path d="M5.5 1 A4.5 4.5 0 0 0 5.5 10 Z" fill="currentColor"/></svg>';
  const MINI = '<svg width="10" height="2" viewBox="0 0 10 2" fill="none"><rect width="10" height="1.5" rx="0.75" fill="currentColor"/></svg>';
  const CHEV = '<svg class="chev" width="8" height="5" viewBox="0 0 8 5" fill="none"><path d="M1 1l3 3 3-3" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

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
            <button class="icon-btn" id="themeBtn" title="Toggle theme">${THEME}</button>
            <button class="icon-btn" id="minBtn" title="Minimize">${MINI}</button>
          </div>
        </div>
        <div class="toolbar" id="toolbar">
          <button class="tb-btn" id="addVersionBtn" title="Add version">${ADDV}</button>
          <div class="version-wrap" id="versionWrap">
            <button class="tb-preset" id="versionBtn"><span id="versionLabel">Version 1</span>${CHEV}</button>
            <div class="version-menu" id="versionMenu"></div>
          </div>
          <button class="tb-btn" id="copyBtn" title="Copy CSS">${COPY}</button>
        </div>
        <div class="pb" id="panelBody">
          <div class="select-hint visible" id="selectHint">Select text to edit</div>
          <div id="controls" class="disabled">
            <div class="section-head"><span>Typography</span></div>
            ${slider('fontSize','Size',8,120,0.5,'—')}
            ${slider('fontWeight','Weight',100,900,100,'—')}
            ${slider('lineHeight','Line Height',0.8,3.0,0.05,'—')}
            ${slider('letterSpacing','Spacing',-0.1,0.4,0.005,'—')}
            <div class="section-head"><span>Position</span></div>
            ${slider('translateX','X',-400,400,1,'0px')}
            ${slider('translateY','Y',-400,400,1,'0px')}
            <div class="section-head"><span>Layout</span></div>
            ${slider('maxWidth','Width',40,1600,1,'—')}
            ${slider('padding','Padding',0,80,1,'—')}
            ${slider('borderRadius','Radius',0,50,1,'—')}
            ${slider('opacity','Opacity',0,100,1,'—')}
            <div class="section-head"><span>Font</span></div>
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
            <div class="section-head"><span>Align</span></div>
            <div class="align-seg">
              <button class="align-btn" data-align="left" title="Left"><svg width="12" height="10" viewBox="0 0 12 10" fill="none"><line x1="0" y1="1" x2="12" y2="1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="0" y1="5" x2="8.4" y2="5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="0" y1="9" x2="6.6" y2="9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>
              <button class="align-btn" data-align="center" title="Center"><svg width="12" height="10" viewBox="0 0 12 10" fill="none"><line x1="0" y1="1" x2="12" y2="1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="1.8" y1="5" x2="10.2" y2="5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="2.7" y1="9" x2="9.3" y2="9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>
              <button class="align-btn" data-align="right" title="Right"><svg width="12" height="10" viewBox="0 0 12 10" fill="none"><line x1="0" y1="1" x2="12" y2="1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="3.6" y1="5" x2="12" y2="5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="5.4" y1="9" x2="12" y2="9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>
              <button class="align-btn" data-align="justify" title="Justify"><svg width="12" height="10" viewBox="0 0 12 10" fill="none"><line x1="0" y1="1" x2="12" y2="1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="0" y1="5" x2="12" y2="5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="0" y1="9" x2="7.2" y2="9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>
            </div>
            <div class="reset-row"><button class="reset-btn" id="resetBtn">Reset</button></div>
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
  const copyBtn = $('copyBtn'), resetBtn = $('resetBtn'), themeBtn = $('themeBtn'), minBtn = $('minBtn');
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
             letterSpacing: s.letterSpacing, fontFamily: s.fontFamily, textAlign: s.textAlign, transform: s.transform, maxWidth: s.maxWidth, padding: s.padding, borderRadius: s.borderRadius, opacity: s.opacity, fontStyle: s.fontStyle, textDecoration: s.textDecoration };
  }
  function pushUndo() { if (selection.length) undoStack.push(selection.map(snapOne)); }
  function popUndo() {
    const entry = undoStack.pop(); if (!entry) return;
    entry.forEach(s => {
      const st = s.el.style;
      st.fontSize = s.fontSize; st.fontWeight = s.fontWeight; st.lineHeight = s.lineHeight;
      st.letterSpacing = s.letterSpacing; st.fontFamily = s.fontFamily; st.textAlign = s.textAlign; st.transform = s.transform; st.maxWidth = s.maxWidth; st.padding = s.padding; st.borderRadius = s.borderRadius; st.opacity = s.opacity; st.fontStyle = s.fontStyle; st.textDecoration = s.textDecoration;
    });
    if (active) { const m = new DOMMatrix(getComputedStyle(active).transform); txX = Math.round(m.m41); txY = Math.round(m.m42); syncFrom(active); }
    saveCurrentVersion(); updateSelBoxes();
  }

  // ── Versions + change badges (keyed on live element refs, not data-id) ──
  let versions = [{ name: 'Version 1', styles: [] }];
  let currentVersionIdx = 0;
  const badgeNodes = [];  // {el, node}

  const emptySnap = el => ({ el, fontSize: '', fontWeight: '', lineHeight: '', letterSpacing: '', fontFamily: '', textAlign: '', transform: '', maxWidth: '', padding: '', borderRadius: '', opacity: '', fontStyle: '', textDecoration: '' });
  // As new elements are touched, backfill every existing version with an empty
  // snapshot so switching to an OLDER version correctly clears them.
  function trackEdited(el) {
    if (edited.has(el)) return;
    edited.add(el);
    versions.forEach(v => { if (!v.styles.some(o => o.el === el)) v.styles.push(emptySnap(el)); });
  }
  function captureAllStyles() {
    return [...edited].map(el => ({ el, fontSize: el.style.fontSize, fontWeight: el.style.fontWeight, lineHeight: el.style.lineHeight,
      letterSpacing: el.style.letterSpacing, fontFamily: el.style.fontFamily, textAlign: el.style.textAlign, transform: el.style.transform, maxWidth: el.style.maxWidth, padding: el.style.padding, borderRadius: el.style.borderRadius, opacity: el.style.opacity, fontStyle: el.style.fontStyle, textDecoration: el.style.textDecoration }));
  }
  function applyAllStyles(arr) {
    arr.forEach(o => { const s = o.el.style; s.fontSize = o.fontSize; s.fontWeight = o.fontWeight; s.lineHeight = o.lineHeight;
      s.letterSpacing = o.letterSpacing; s.fontFamily = o.fontFamily; s.textAlign = o.textAlign; s.transform = o.transform; s.maxWidth = o.maxWidth; s.padding = o.padding; s.borderRadius = o.borderRadius; s.opacity = o.opacity; s.fontStyle = o.fontStyle; s.textDecoration = o.textDecoration; });
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
  const isChanged = el => { const s = el.style; return !!(s.fontFamily || s.fontSize || s.fontWeight || s.lineHeight || s.letterSpacing || s.textAlign || s.maxWidth || s.padding || s.borderRadius || s.opacity || s.fontStyle || s.textDecoration || (s.transform && s.transform !== 'none')); };
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
  function resyncHeight() { if (!minimized) panel.style.height = panelInner.offsetHeight + 'px'; }
  function expand() {
    if (!minimized) return;
    originX = computeOrigin(); panel.dataset.originX = originX;
    const targetH = panelInner.offsetHeight;
    panel.classList.remove('minimized');
    panel.style.width = PANEL_W + 'px'; panel.style.height = targetH + 'px'; panel.style.borderRadius = '14px';
    layoutExpanded(); minimized = false;
    document.body && (document.body.style.cursor = 'crosshair');   // select mode on
    updateBadges();
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
  themeBtn.addEventListener('click', e => { e.stopPropagation(); panel.classList.toggle('panel-light'); });

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
  }
  function positionSelBoxes() { selBoxes.forEach(b => { if (b.el) boxTo(b.node, b.el); }); }

  const inOverlay = e => e.composedPath().includes(hostEl);
  const hasText = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length);
  // agentation-style targeting: only highlight real CONTENT elements. Skip
  // structural tags, elements without their own text (wrappers), and anything
  // that spans nearly the whole page — so hovering a container's padding never
  // washes the whole preview blue.
  const SKIP_TAGS = new Set(['html', 'body', 'head', 'script', 'style', 'noscript', 'link', 'meta', 'svg', 'path', 'br', 'hr']);
  function pickable(el) {
    if (!el || el === hostEl || hostEl.contains(el)) return false;
    if (el === document.documentElement || el === document.body) return false;
    if (SKIP_TAGS.has(el.tagName.toLowerCase())) return false;
    if (!hasText(el)) return false;                              // must carry its own text (not a wrapper)
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
    if (['div', 'section', 'article', 'nav', 'header', 'footer', 'aside', 'main'].includes(tag)) {
      const aria = el.getAttribute('aria-label'); if (aria) return `${tag} [${aria}]`;
      const role = el.getAttribute('role'); if (role) return role;
      const cls = typeof el.className === 'string' ? el.className.trim() : '';
      if (cls) return cls.split(/[\s_-]+/).filter(Boolean).slice(0, 2).join(' ');   // e.g. "flex flex-col" -> "flex flex"
      return tag;
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
  }

  function updateHint() {
    phTitle.textContent = selection.length > 1 ? `TypeSet · ${selection.length}` : 'TypeSet';
    if (selection.length) { selectHint.classList.remove('visible'); controls.classList.remove('disabled'); }
    else { selectHint.classList.add('visible'); controls.classList.add('disabled'); }
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
      if (hostEl.contains(el) || !hasText(el)) return;
      const rc = el.getBoundingClientRect();
      if (rc.width === 0 || rc.height === 0) return;
      if (rc.left < r && rc.right > l && rc.top < b && rc.bottom > t) hits.push(el);   // AABB overlap (agentation-style)
    });
    return hits;
  }

  // While expanded: a click (no drag) selects one (shift-click toggles into a
  // group); a drag draws a marquee and selects every text element it overlaps.
  let mDown = false, mMoved = false, mx0 = 0, my0 = 0, mShift = false;
  function onPD(e) {
    if (inOverlay(e) || !selecting()) return;
    e.preventDefault(); e.stopPropagation();
    mDown = true; mMoved = false; mx0 = e.clientX; my0 = e.clientY; mShift = e.shiftKey;
  }
  function onPM(e) {
    if (mDown) {
      if (!mMoved && Math.hypot(e.clientX - mx0, e.clientY - my0) > 6) mMoved = true;
      if (mMoved) {
        const l = Math.min(mx0, e.clientX), t = Math.min(my0, e.clientY), r = Math.max(mx0, e.clientX), b = Math.max(my0, e.clientY);
        marquee.style.display = 'block'; marquee.style.left = l + 'px'; marquee.style.top = t + 'px'; marquee.style.width = (r - l) + 'px'; marquee.style.height = (b - t) + 'px';
        hideHover();
      }
      return;
    }
    if (selecting()) { const el = document.elementFromPoint(e.clientX, e.clientY); if (pickable(el)) { boxTo(hoverBox, el); showLabel(el); } else hideHover(); }
  }
  function onPU(e) {
    if (!mDown) return;
    mDown = false; marquee.style.display = 'none';
    if (mMoved) {
      const l = Math.min(mx0, e.clientX), t = Math.min(my0, e.clientY), r = Math.max(mx0, e.clientX), b = Math.max(my0, e.clientY);
      const hits = elementsInRect(l, t, r, b);
      if (hits.length) setSelection(mShift ? [...new Set([...selection, ...hits])] : hits);
    } else {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (pickable(el)) selectEl(el, mShift);
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
    const wid = cs.maxWidth === 'none' ? Math.round(parseFloat(cs.width)) : Math.round(parseFloat(cs.maxWidth));
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
    updateRowTrack('maxWidth', wid);
    vEl('padding').textContent = pad + 'px';
    vEl('borderRadius').textContent = rad + 'px';
    const opa = Math.round((parseFloat(cs.opacity) || 1) * 100);
    updateRowTrack('padding', pad); updateRowTrack('borderRadius', rad);
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
    if (prop === 'maxWidth') return cs.maxWidth === 'none' ? Math.round(parseFloat(cs.width)) : Math.round(parseFloat(cs.maxWidth));
    if (prop === 'padding') return Math.round(parseFloat(cs.paddingTop)) || 0;
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
      else if (prop === 'maxWidth') s.maxWidth = val + 'px';
      else if (prop === 'padding') s.padding = val + 'px';
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
    const props = ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'fontFamily', 'textAlign', 'transform', 'maxWidth', 'padding', 'borderRadius', 'opacity', 'fontStyle', 'textDecoration'];
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
  function triggerCopy() {
    const blocks = [];
    edited.forEach(el => {
      const s = el.style;
      const lines = [
        s.fontFamily && `font-family: ${s.fontFamily};`,
        s.fontSize && `font-size: ${s.fontSize};`,
        s.fontWeight && `font-weight: ${s.fontWeight};`,
        s.lineHeight && `line-height: ${s.lineHeight};`,
        s.letterSpacing && `letter-spacing: ${s.letterSpacing};`,
        s.textAlign && `text-align: ${s.textAlign};`,
        s.maxWidth && `max-width: ${s.maxWidth};`,
        s.padding && `padding: ${s.padding};`,
        s.borderRadius && `border-radius: ${s.borderRadius};`,
        s.opacity && `opacity: ${s.opacity};`,
        s.fontStyle && `font-style: ${s.fontStyle};`,
        s.textDecoration && `text-decoration: ${s.textDecoration};`,
        s.transform && s.transform !== 'none' && `transform: ${s.transform};`,
      ].filter(Boolean);
      if (lines.length) blocks.push(`${cssSelector(el)} {\n  ${lines.join('\n  ')}\n}`);
    });
    if (!blocks.length) return;
    navigator.clipboard.writeText('/* TypeSet — ' + versions[currentVersionIdx].name + ' */\n\n' + blocks.join('\n\n')).then(() => {
      const orig = copyBtn.innerHTML;
      copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12.75L10 19L19 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      copyBtn.classList.add('copied');
      setTimeout(() => { copyBtn.innerHTML = orig; copyBtn.classList.remove('copied'); }, 1500);
    });
  }
  copyBtn.addEventListener('click', triggerCopy);

  // ── Keyboard ──
  function onKey(e) {
    if (e.key === 'Escape' && selection.length) { setSelection([]); return; }
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
