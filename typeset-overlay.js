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
      --bg:#141414; --bg-hover:rgba(255,255,255,0.06); --border:rgba(255,255,255,0.08);
      --border-sub:rgba(255,255,255,0.06); --text-hi:rgba(255,255,255,0.9);
      --text-mid:rgba(255,255,255,0.55); --text-lo:rgba(255,255,255,0.18);
      --text-val:rgba(255,255,255,0.6); --chip-bg:rgba(255,255,255,0.07);
      --chip-bdr:rgba(255,255,255,0.06); --chip-hover:rgba(255,255,255,0.12);
      --sel-bg:rgba(255,255,255,0.06); --sel-bdr:rgba(255,255,255,0.1); --sel-col:rgba(255,255,255,0.75);
      --ab-bg:rgba(255,255,255,0.05); --ab-bdr:rgba(255,255,255,0.1); --ab-col:rgba(255,255,255,0.3);
      --ab-act-bg:rgba(255,255,255,0.12); --ab-act-bdr:rgba(255,255,255,0.22);
      --ring:rgba(255,255,255,0.1); --shadow:rgba(0,0,0,0.6); --icon-col:rgba(255,255,255,0.3);
      --dial-bg:#141414; --dial-icon:rgba(255,255,255,0.85);
      --badge-bg:rgba(255,255,255,0.07); --badge-col:rgba(255,255,255,0.4);
      --sl-track:rgba(255,255,255,0.05); --sl-fill:rgba(255,255,255,0.11); --sl-fill-act:rgba(255,255,255,0.16);
      --sl-hash:rgba(255,255,255,0.15); --sl-handle:rgba(255,255,255,0.95); --radius:8px;
      --accent:#0066ff;
      position:fixed; width:260px; background:var(--bg); border-radius:14px;
      box-shadow:0 0 0 0.5px var(--ring),0 16px 48px var(--shadow),0 4px 12px rgba(0,0,0,0.35);
      overflow:hidden; z-index:2147483647; user-select:none; right:20px; top:20px;
      font-family:'Inter',system-ui,sans-serif;
      transition:width .34s cubic-bezier(.32,.72,0,1),height .34s cubic-bezier(.32,.72,0,1),
        left .34s cubic-bezier(.32,.72,0,1),top .34s cubic-bezier(.32,.72,0,1),
        border-radius .3s cubic-bezier(.32,.72,0,1),background .2s ease,box-shadow .28s ease;
    }
    #panel.panel-dragging { transition:none; }
    .panel-inner { width:260px; opacity:1; transition:opacity .16s ease; }

    #panel.panel-light {
      --bg:#fff; --bg-hover:rgba(0,0,0,0.05); --border:rgba(0,0,0,0.08); --border-sub:rgba(0,0,0,0.05);
      --text-hi:rgba(0,0,0,0.85); --text-mid:rgba(0,0,0,0.5); --text-lo:rgba(0,0,0,0.2); --text-val:rgba(0,0,0,0.55);
      --chip-bg:rgba(0,0,0,0.06); --chip-bdr:rgba(0,0,0,0.06); --chip-hover:rgba(0,0,0,0.1);
      --sel-bg:rgba(0,0,0,0.04); --sel-bdr:rgba(0,0,0,0.1); --sel-col:rgba(0,0,0,0.7);
      --ab-bg:rgba(0,0,0,0.04); --ab-bdr:rgba(0,0,0,0.1); --ab-col:rgba(0,0,0,0.3);
      --ab-act-bg:rgba(0,0,0,0.08); --ab-act-bdr:rgba(0,0,0,0.18); --ring:rgba(0,0,0,0.08); --shadow:rgba(0,0,0,0.18);
      --icon-col:rgba(0,0,0,0.3); --dial-bg:rgba(30,30,30,0.9); --dial-icon:#fff;
      --badge-bg:rgba(0,0,0,0.06); --badge-col:rgba(0,0,0,0.35);
      --sl-track:rgba(0,0,0,0.05); --sl-fill:rgba(0,0,0,0.09); --sl-fill-act:rgba(0,0,0,0.14);
      --sl-hash:rgba(0,0,0,0.15); --sl-handle:rgba(0,0,0,0.8);
    }

    #panel.minimized { background:var(--dial-bg); box-shadow:0 2px 12px rgba(0,0,0,0.22),0 0 0 0.5px rgba(0,0,0,0.08); cursor:grab; }
    #panel.minimized:active { cursor:grabbing; }
    #panel.minimized .panel-inner { opacity:0; pointer-events:none; }
    .dial-icon { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      opacity:0; transition:opacity .14s ease; pointer-events:none; color:var(--dial-icon);
      font-family:'DM Serif Display','Playfair Display',Georgia,serif; font-size:19px; font-weight:400; line-height:1; }
    #panel.minimized .dial-icon { opacity:1; }

    .ph { display:flex; align-items:center; justify-content:space-between; padding:10px 12px 9px; cursor:grab; border-bottom:0.5px solid var(--border); }
    .ph:active { cursor:grabbing; }
    .ph-title { font-size:12px; font-weight:600; color:var(--text-hi); letter-spacing:-0.01em; }
    .ph-right { display:flex; align-items:center; gap:5px; }
    .icon-btn, .copy-btn { width:22px; height:22px; display:flex; align-items:center; justify-content:center; border:none; background:none; cursor:pointer; border-radius:6px; color:var(--icon-col); transition:color .12s,background .12s; }
    .icon-btn:hover, .copy-btn:hover { background:var(--bg-hover); color:var(--text-hi); }
    .copy-btn.copied { color:#4ade80; }
    .pick-btn.active { background:var(--accent); color:#fff; }
    .pick-btn.active:hover { background:var(--accent); color:#fff; }

    .version-wrap { position:relative; }
    .version-btn { font-size:10px; font-weight:500; color:var(--badge-col); background:var(--badge-bg); border:none; border-radius:100px; padding:2px 7px; cursor:pointer; display:flex; align-items:center; gap:3px; transition:background .12s,color .12s; font-family:inherit; }
    .version-btn:hover { background:var(--chip-hover); color:var(--text-hi); }
    .version-menu { position:absolute; top:calc(100% + 6px); right:0; background:var(--bg); border:0.5px solid var(--border); border-radius:10px; box-shadow:0 8px 28px rgba(0,0,0,0.45); min-width:130px; overflow:hidden; display:none; z-index:100; }
    .version-menu.open { display:block; }
    .version-item { padding:7px 12px; font-size:11px; color:var(--text-mid); cursor:pointer; display:flex; align-items:center; justify-content:space-between; transition:background .1s,color .1s; gap:8px; }
    .version-item:hover { background:var(--bg-hover); color:var(--text-hi); }
    .version-item.current { color:var(--text-hi); }
    .ver-check { color:#4ade80; font-size:10px; flex-shrink:0; display:none; }
    .version-item.current .ver-check { display:block; }
    .version-sep { height:0.5px; background:var(--border-sub); margin:2px 0; }
    .version-add-row { padding:7px 12px; font-size:11px; color:var(--text-lo); cursor:pointer; transition:background .1s,color .1s; }
    .version-add-row:hover { background:var(--bg-hover); color:var(--text-hi); }

    /* change badges — floating over each edited host element (click to re-select) */
    .ts-badge { position:fixed; transform:translate(-50%,-50%); width:20px; height:20px; border-radius:50%;
      background:#22c55e; color:#fff; font:700 10px/1 'Inter',sans-serif; display:flex; align-items:center; justify-content:center;
      pointer-events:auto; cursor:pointer; z-index:2147483646; box-shadow:0 1px 6px rgba(0,0,0,0.22); }
    .ts-badge:hover { background:#16a34a; }

    .pb { overflow-y:auto; max-height:calc(100vh - 160px); }
    .select-hint { font-size:11px; color:var(--text-mid); text-align:center; padding:14px 10px 10px; letter-spacing:0.02em; display:none; }
    .select-hint.visible { display:block; }
    #controls { transition:opacity .15s; }
    #controls.disabled { opacity:0.22; pointer-events:none; }

    .section-head { display:flex; align-items:center; justify-content:space-between; padding:8px 12px 6px; border-top:0.5px solid var(--border-sub); }
    .section-head span { font-size:10px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:var(--text-lo); }
    .row { display:flex; align-items:center; padding:4px 10px; gap:8px; min-height:34px; }

    .align-row { display:flex; gap:4px; flex:1; justify-content:flex-end; }
    .align-btn { width:28px; height:24px; border:0.5px solid var(--ab-bdr); background:var(--ab-bg); color:var(--ab-col); border-radius:8px; cursor:pointer; transition:all .12s; display:flex; align-items:center; justify-content:center; font-size:13px; }
    .align-btn:hover { color:var(--text-hi); border-color:var(--chip-hover); }
    .align-btn.active { background:var(--ab-act-bg); border-color:var(--ab-act-bdr); color:var(--text-hi); }
    .reset-row { padding:8px 10px; border-top:0.5px solid var(--border-sub); }
    .reset-btn { width:100%; padding:6px; background:rgba(255,60,60,0.07); border:0.5px solid rgba(255,60,60,0.15); border-radius:8px; color:rgba(255,100,100,0.6); font-size:11px; cursor:pointer; transition:all .12s; }
    .reset-btn:hover { background:rgba(255,60,60,0.13); color:rgba(255,120,120,0.9); }

    .sl-row { padding:3px 10px; }
    .ts-slider { position:relative; height:34px; background:var(--sl-track); border:0.5px solid var(--chip-bdr); border-radius:var(--radius); overflow:hidden; cursor:pointer; touch-action:none; user-select:none; }
    .ts-slider.snapping { transition:width .34s cubic-bezier(.22,1,.36,1),transform .34s cubic-bezier(.22,1,.36,1); }
    .ts-slider-hashmarks { position:absolute; inset:0; pointer-events:none; }
    .ts-slider-hashmark { position:absolute; top:50%; width:1px; height:8px; border-radius:999px; transform:translate(-50%,-50%); background:transparent; transition:background .2s; }
    .ts-slider.active .ts-slider-hashmark { background:var(--sl-hash); }
    .ts-slider-fill { position:absolute; top:0; bottom:0; left:0; width:0%; background:var(--sl-fill); transition:background .15s; pointer-events:none; }
    .ts-slider.active .ts-slider-fill { background:var(--sl-fill-act); }
    .ts-slider-handle { position:absolute; top:50%; left:0; width:3px; height:18px; border-radius:999px; background:var(--sl-handle); pointer-events:none; opacity:0; transform:translateY(-50%) scaleX(0.25); transition:opacity .18s ease,transform .18s cubic-bezier(.32,.72,0,1); }
    .ts-slider-label { position:absolute; left:10px; top:50%; transform:translateY(-50%); font-size:11px; font-weight:500; color:var(--text-mid); pointer-events:none; transition:color .15s; white-space:nowrap; }
    .ts-slider.active .ts-slider-label { color:var(--text-hi); }
    .ts-slider-value { position:absolute; right:10px; top:50%; transform:translateY(-50%); font-size:11px; font-weight:500; font-family:'Fragment Mono','Geist Mono',monospace; color:var(--text-val); pointer-events:auto; border-bottom:1px solid transparent; padding-bottom:1px; transition:color .15s,border-color .15s; }
    .ts-slider.active .ts-slider-value { color:var(--text-hi); }
    .ts-slider-value.editable { border-bottom-color:var(--text-mid); cursor:text; }
    .ts-slider-input { position:absolute; right:10px; top:50%; transform:translateY(-50%); width:5ch; text-align:right; background:transparent; border:none; border-bottom:1px solid var(--text-mid); outline:none; padding:0 0 1px 0; font-size:11px; font-weight:500; font-family:'Fragment Mono','Geist Mono',monospace; color:var(--text-hi); display:none; }

    .font-picker { padding:4px 10px 8px; }
    .font-trigger { width:100%; display:flex; align-items:center; justify-content:space-between; gap:8px; background:var(--sel-bg); border:0.5px solid var(--sel-bdr); border-radius:8px; color:var(--sel-col); font-size:14px; padding:7px 10px; cursor:pointer; transition:background .12s,border-color .12s; text-align:left; }
    .font-trigger:hover { border-color:var(--chip-hover); }
    .font-trigger-name { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; line-height:1.1; }
    .font-trigger .chev { color:var(--text-mid); flex-shrink:0; transition:transform .18s cubic-bezier(.32,.72,0,1); }
    .font-picker.open .font-trigger .chev { transform:rotate(180deg); }
    .font-list { display:none; margin-top:5px; max-height:232px; overflow-y:auto; background:var(--sel-bg); border:0.5px solid var(--sel-bdr); border-radius:8px; padding:3px; }
    .font-picker.open .font-list { display:block; }
    .font-group-label { font-size:9px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:var(--text-lo); padding:7px 8px 3px; }
    .font-item { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:7px 9px; border-radius:6px; cursor:pointer; color:var(--text-mid); font-size:15px; line-height:1.15; transition:background .1s,color .1s; }
    .font-item span:first-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .font-item:hover { background:var(--bg-hover); color:var(--text-hi); }
    .font-item.current { color:var(--text-hi); }
    .fi-check { color:#4ade80; font-size:11px; flex-shrink:0; opacity:0; }
    .font-item.current .fi-check { opacity:1; }

    /* host-page highlighters (position:fixed escapes shadow, tracks viewport).
       NOTE: these are siblings of #panel, so #panel's --accent is out of scope —
       use literal colors here. */
    .ts-box { position:fixed; pointer-events:none; z-index:2147483646; border-radius:2px; display:none; }
    #hoverBox { border:1.5px dashed rgba(0,102,255,0.7); background:rgba(0,102,255,0.06); }
    #selBox { border:2px solid #0066ff; box-shadow:0 0 0 1px rgba(0,102,255,0.25); }
  `;

  const CROSS = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v11M1 6.5h11" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="6.5" cy="6.5" r="2.4" stroke="currentColor" stroke-width="1.2"/></svg>';
  const COPY = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.1"/><path d="M3 8H2a1 1 0 01-1-1V2a1 1 0 011-1h5a1 1 0 011 1v1" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>';
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
            <div class="version-wrap" id="versionWrap">
              <button class="version-btn" id="versionBtn"><span id="versionLabel">V1</span>${CHEV}</button>
              <div class="version-menu" id="versionMenu"></div>
            </div>
            <button class="icon-btn pick-btn active" id="pickBtn" title="Pick an element">${CROSS}</button>
            <button class="copy-btn" id="copyBtn" title="Copy CSS">${COPY}</button>
            <button class="icon-btn" id="themeBtn" title="Toggle theme">${THEME}</button>
            <button class="icon-btn" id="minBtn" title="Minimize">${MINI}</button>
          </div>
        </div>
        <div class="pb" id="panelBody">
          <div class="select-hint visible" id="selectHint">Click any text on the page</div>
          <div id="controls" class="disabled">
            <div class="section-head"><span>Typography</span></div>
            ${slider('fontSize','Size',8,120,0.5,'—')}
            ${slider('fontWeight','Weight',100,900,100,'—')}
            ${slider('lineHeight','Line Height',0.8,3.0,0.05,'—')}
            ${slider('letterSpacing','Spacing',-0.1,0.4,0.005,'—')}
            <div class="section-head"><span>Position</span></div>
            ${slider('translateX','X',-400,400,1,'0px')}
            ${slider('translateY','Y',-400,400,1,'0px')}
            <div class="section-head"><span>Family</span></div>
            <div class="font-picker" id="fontPicker">
              <button class="font-trigger" id="fontTrigger" type="button">
                <span class="font-trigger-name" id="fontTriggerName">—</span>${CHEV}
              </button>
              <div class="font-list" id="fontList"></div>
            </div>
            <div class="section-head"><span>Align</span></div>
            <div class="row"><div class="align-row">
              <button class="align-btn" data-align="left">←</button>
              <button class="align-btn" data-align="center">↔</button>
              <button class="align-btn" data-align="right">→</button>
            </div></div>
            <div class="reset-row"><button class="reset-btn" id="resetBtn">Reset</button></div>
          </div>
        </div>
      </div>
    </div>
    <div class="ts-box" id="hoverBox"></div>
    <div class="ts-box" id="selBox"></div>`;

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
  const copyBtn = $('copyBtn'), resetBtn = $('resetBtn'), themeBtn = $('themeBtn'), minBtn = $('minBtn'), pickBtn = $('pickBtn');
  const hoverBox = $('hoverBox'), selBox = $('selBox');
  const fontPicker = $('fontPicker'), fontTrigger = $('fontTrigger'), fontTriggerName = $('fontTriggerName'), fontList = $('fontList');

  let active = null, txX = 0, txY = 0;
  const edited = new Set();       // host elements TypeSet has changed (for Copy CSS)

  // ── Undo (stores live node refs — safe, no reload during a session) ──
  const undoStack = [];
  function snap() {
    if (!active) return null;
    const s = active.style;
    return { el: active, fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight,
             letterSpacing: s.letterSpacing, fontFamily: s.fontFamily, textAlign: s.textAlign, transform: s.transform, txX, txY };
  }
  function pushUndo() { const s = snap(); if (s) undoStack.push(s); }
  function popUndo() {
    const s = undoStack.pop(); if (!s) return;
    const el = s.el;
    el.style.fontSize = s.fontSize; el.style.fontWeight = s.fontWeight; el.style.lineHeight = s.lineHeight;
    el.style.letterSpacing = s.letterSpacing; el.style.fontFamily = s.fontFamily; el.style.textAlign = s.textAlign; el.style.transform = s.transform;
    if (active === el) { txX = s.txX; txY = s.txY; syncFrom(el); }
    saveCurrentVersion(); positionSelBox();
  }

  // ── Versions + change badges (keyed on live element refs, not data-id) ──
  let versions = [{ name: 'V1', styles: [] }];
  let currentVersionIdx = 0;
  const badgeNodes = [];  // {el, node}

  const emptySnap = el => ({ el, fontSize: '', fontWeight: '', lineHeight: '', letterSpacing: '', fontFamily: '', textAlign: '', transform: '' });
  // As new elements are touched, backfill every existing version with an empty
  // snapshot so switching to an OLDER version correctly clears them.
  function trackEdited(el) {
    if (edited.has(el)) return;
    edited.add(el);
    versions.forEach(v => { if (!v.styles.some(o => o.el === el)) v.styles.push(emptySnap(el)); });
  }
  function captureAllStyles() {
    return [...edited].map(el => ({ el, fontSize: el.style.fontSize, fontWeight: el.style.fontWeight, lineHeight: el.style.lineHeight,
      letterSpacing: el.style.letterSpacing, fontFamily: el.style.fontFamily, textAlign: el.style.textAlign, transform: el.style.transform }));
  }
  function applyAllStyles(arr) {
    arr.forEach(o => { const s = o.el.style; s.fontSize = o.fontSize; s.fontWeight = o.fontWeight; s.lineHeight = o.lineHeight;
      s.letterSpacing = o.letterSpacing; s.fontFamily = o.fontFamily; s.textAlign = o.textAlign; s.transform = o.transform; });
  }
  function saveCurrentVersion() { versions[currentVersionIdx].styles = captureAllStyles(); updateBadges(); }
  function switchVersion(idx) {
    saveCurrentVersion(); currentVersionIdx = idx; applyAllStyles(versions[idx].styles); updateBadges();
    txX = 0; txY = 0;
    if (active) { const m = new DOMMatrix(getComputedStyle(active).transform); txX = Math.round(m.m41); txY = Math.round(m.m42); syncFrom(active); positionSelBox(); }
    renderVersionMenu();
  }
  function addVersion() {
    saveCurrentVersion();
    versions.push({ name: 'V' + (versions.length + 1), styles: captureAllStyles() });
    currentVersionIdx = versions.length - 1; renderVersionMenu();
  }
  function renderVersionMenu() {
    const menu = $('versionMenu'); $('versionLabel').textContent = versions[currentVersionIdx].name;
    menu.innerHTML = versions.map((v, i) => `<div class="version-item ${i === currentVersionIdx ? 'current' : ''}" data-idx="${i}"><span>${v.name}</span><span class="ver-check">✓</span></div>`).join('')
      + `<div class="version-sep"></div><div class="version-add-row" id="vAddRow">+ Add version</div>`;
    menu.querySelectorAll('.version-item').forEach(it => it.addEventListener('click', () => { switchVersion(parseInt(it.dataset.idx)); closeVersionMenu(); }));
    $('vAddRow').addEventListener('click', () => { addVersion(); closeVersionMenu(); });
  }
  function closeVersionMenu() { $('versionMenu').classList.remove('open'); }
  $('versionBtn').addEventListener('click', e => { e.stopPropagation(); $('versionMenu').classList.toggle('open'); });
  root.addEventListener('click', e => { if (!e.target.closest('#versionWrap')) closeVersionMenu(); });

  const isChanged = el => { const s = el.style; return !!(s.fontFamily || s.fontSize || s.fontWeight || s.lineHeight || s.letterSpacing || s.textAlign || (s.transform && s.transform !== 'none')); };
  function updateBadges() {
    badgeNodes.forEach(b => b.node.remove()); badgeNodes.length = 0;
    let i = 0;
    edited.forEach(el => {
      if (!isChanged(el)) return;
      i++;
      const node = document.createElement('div');
      node.className = 'ts-badge'; node.textContent = i; node.title = 'Edited — click to select';
      node.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); setPicking(false); selectEl(el); });
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
  }
  function collapse() {
    if (minimized) return;
    const r = panel.getBoundingClientRect();
    iconX = originX === 'right' ? (r.right - ICON) : r.left; iconY = r.top;
    panel.style.transition = 'none'; panel.style.height = panel.offsetHeight + 'px'; panel.offsetHeight; panel.style.transition = '';
    panel.classList.add('minimized');
    panel.style.width = ICON + 'px'; panel.style.height = ICON + 'px'; panel.style.borderRadius = '50%';
    layoutCollapsed(); minimized = true;
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
  let picking = false;
  function setPicking(on) {
    picking = on;
    pickBtn.classList.toggle('active', on);
    hoverBox.style.display = 'none';
    document.body && (document.body.style.cursor = on ? 'crosshair' : '');
  }
  function boxTo(box, el) {
    if (!el) { box.style.display = 'none'; return; }
    const r = el.getBoundingClientRect();
    box.style.display = 'block'; box.style.left = r.left + 'px'; box.style.top = r.top + 'px';
    box.style.width = r.width + 'px'; box.style.height = r.height + 'px';
  }
  const positionSelBox = () => { if (active) boxTo(selBox, active); else selBox.style.display = 'none'; };

  const inOverlay = e => e.composedPath().includes(hostEl);
  function onMove(e) {
    if (!picking) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === hostEl || el === document.documentElement || el === document.body) { hoverBox.style.display = 'none'; return; }
    boxTo(hoverBox, el);
  }
  function onPick(e) {
    if (!picking || inOverlay(e)) return;
    e.preventDefault(); e.stopPropagation();
    selectEl(e.target);
    setPicking(false);
  }
  function selectEl(el) {
    active = el;
    const mat = new DOMMatrix(getComputedStyle(el).transform);
    txX = Math.round(mat.m41); txY = Math.round(mat.m42);
    syncFrom(el);
    selectHint.classList.remove('visible'); controls.classList.remove('disabled');
    resyncHeight(); positionSelBox();
  }
  document.addEventListener('pointermove', onMove, true);
  document.addEventListener('click', onPick, true);
  document.addEventListener('pointerdown', e => { if (picking && !inOverlay(e)) { e.preventDefault(); e.stopPropagation(); } }, true);
  pickBtn.addEventListener('click', e => { e.stopPropagation(); setPicking(!picking); });
  const onScroll = () => { positionSelBox(); positionBadges(); if (picking) hoverBox.style.display = 'none'; };
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', () => { positionSelBox(); positionBadges(); if (minimized) { iconX = clamp(iconX, 0, innerWidth - ICON); iconY = clamp(iconY, 0, innerHeight - ICON); layoutCollapsed(); } });

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
      if (active) { pushUndo(); active.style.fontFamily = val; trackEdited(active); saveCurrentVersion(); setFontUI(val); positionSelBox(); }
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
    return Math.round(v) + 'px';
  }
  const vEl = prop => root.querySelector(`.ts-slider-value[data-v="${prop}"]`);
  function syncFrom(el) {
    const cs = getComputedStyle(el), fsz = parseFloat(cs.fontSize);
    const lh = isNaN(parseFloat(cs.lineHeight) / fsz) ? 1.4 : Math.round((parseFloat(cs.lineHeight) / fsz) * 100) / 100;
    const lsPx = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing);
    const ls = Math.round((lsPx / fsz) * 1000) / 1000;
    const mat = new DOMMatrix(cs.transform); txX = Math.round(mat.m41); txY = Math.round(mat.m42);
    vEl('fontSize').textContent = Math.round(fsz) + 'px';
    vEl('fontWeight').textContent = parseInt(cs.fontWeight) || 400;
    vEl('lineHeight').textContent = lh.toFixed(2);
    vEl('letterSpacing').textContent = ls.toFixed(3) + 'em';
    vEl('translateX').textContent = txX + 'px';
    vEl('translateY').textContent = txY + 'px';
    updateRowTrack('fontSize', fsz); updateRowTrack('fontWeight', parseInt(cs.fontWeight) || 400);
    updateRowTrack('lineHeight', lh); updateRowTrack('letterSpacing', ls);
    updateRowTrack('translateX', txX); updateRowTrack('translateY', txY);
    setFontUI(cs.fontFamily);
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
    return 0;
  }
  function applyProp(prop, val) {
    if (!active) return;
    if (prop === 'fontSize') active.style.fontSize = val + 'px';
    if (prop === 'fontWeight') active.style.fontWeight = val;
    if (prop === 'lineHeight') active.style.lineHeight = val;
    if (prop === 'letterSpacing') active.style.letterSpacing = val + 'em';
    if (prop === 'translateX') { txX = val; active.style.transform = `translate(${txX}px,${txY}px)`; }
    if (prop === 'translateY') { txY = val; active.style.transform = `translate(${txX}px,${txY}px)`; }
    trackEdited(active);
    updateRowTrack(prop, val); saveCurrentVersion(); positionSelBox();
  }

  // ── Sliders ──
  const decimalsForStep = step => { const s = step.toString(), d = s.indexOf('.'); return d === -1 ? 0 : s.length - d - 1; };
  function setupSlider(s) {
    const prop = s.dataset.prop, min = parseFloat(s.dataset.min), max = parseFloat(s.dataset.max), step = parseFloat(s.dataset.step);
    const valEl = s.querySelector('.ts-slider-value'), input = s.querySelector('.ts-slider-input'), dec = decimalsForStep(step);
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
    if (active) { pushUndo(); active.style.textAlign = btn.dataset.align; trackEdited(active); saveCurrentVersion(); positionSelBox(); }
  }));
  resetBtn.addEventListener('click', () => {
    if (!active) return; pushUndo();
    ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'fontFamily', 'textAlign', 'transform'].forEach(p => active.style[p] = '');
    txX = 0; txY = 0; syncFrom(active); saveCurrentVersion(); positionSelBox();
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
        s.transform && s.transform !== 'none' && `transform: ${s.transform};`,
      ].filter(Boolean);
      if (lines.length) blocks.push(`${cssSelector(el)} {\n  ${lines.join('\n  ')}\n}`);
    });
    if (!blocks.length) return;
    navigator.clipboard.writeText('/* TypeSet — ' + versions[currentVersionIdx].name + ' */\n\n' + blocks.join('\n\n')).then(() => {
      copyBtn.classList.add('copied'); setTimeout(() => copyBtn.classList.remove('copied'), 1500);
    });
  }
  copyBtn.addEventListener('click', triggerCopy);

  // ── Keyboard ──
  function onKey(e) {
    if (e.key === 'Escape' && picking) { setPicking(false); return; }
    if (!e.metaKey && !e.ctrlKey) return;
    if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); popUndo(); }
    else if (e.key === 'c' && active && !window.getSelection().toString()) { e.preventDefault(); triggerCopy(); }
  }
  document.addEventListener('keydown', onKey, true);

  // ── Init: render expanded, top-right, in pick mode ──
  (function init() {
    originX = 'right'; panel.dataset.originX = 'right'; minimized = false;
    panel.style.transition = 'none';
    panel.style.width = PANEL_W + 'px'; panel.style.borderRadius = '14px';
    panel.style.right = 'auto'; panel.style.left = (window.innerWidth - PANEL_W - 20) + 'px'; panel.style.top = '20px';
    panel.style.height = panelInner.offsetHeight + 'px';
    iconX = window.innerWidth - ICON - 20; iconY = 20;
    panel.offsetHeight; panel.style.transition = '';
    renderVersionMenu();
    setPicking(true);
  })();

  // ── Teardown (re-run script to toggle off) ──
  window.__typesetOverlay = {
    destroy() {
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('click', onPick, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
      if (document.body) document.body.style.cursor = '';
      hostEl.remove();
      delete window.__typesetOverlay;
    }
  };
})();
