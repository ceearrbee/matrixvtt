/**
 * Dev-facing log panel. Subscribes to `logger` (via `addLogSink`) and
 * renders warn/error entries whose prefix matches a VTT module tag.
 * Toggled via Ctrl+Shift+L or the `?log` query param.
 *
 * Does not patch `console.*` - layered global-interceptor patterns
 * are fragile; `addLogSink` is the only supported extension point.
 */

import { addLogSink } from '../utils/logger.js';

const LEVEL_COLORS = { debug: '#999', log: '#ccc', info: '#8be', warn: '#fb8', error: '#f88' };
const MAX_ENTRIES = 500;
const PERSIST_KEY = 'vtt:applog';
const PERSIST_MAX = 200;

/**
 * Persist a rolling window of log entries to sessionStorage so they
 * survive page reloads / bfcache restores. Helpful for debugging
 * mobile flows where the only visible symptom is "the page just
 * refreshed" - without persistence the log panel resets to empty.
 */
function loadPersisted(win) {
  try {
    const raw = win.sessionStorage?.getItem(PERSIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function savePersisted(win, entries) {
  try {
    const slice = entries.slice(-PERSIST_MAX);
    win.sessionStorage?.setItem(PERSIST_KEY, JSON.stringify(slice));
  } catch { /* quota / private mode */ }
}

/**
 * Read the persisted app-log as a plain `ts [level] msg` block, for bundling
 * into a feedback/diagnostics report. Returns '' when nothing is captured.
 */
export function readPersistedLog(win = window) {
  return loadPersisted(win)
    .map((e) => `${e.ts} [${e.level}] ${e.msg}`)
    .join('\n');
}

export function createAppLog(doc = document, win = window) {
  const entries = loadPersisted(win);
  let panel = null;
  let visible = false;

  function render() {
    if (!panel) return;
    const body = panel.querySelector('[data-applog-body]');
    if (!body) return;
    body.innerHTML = entries
      .map((e) => {
        const safe = String(e.msg)
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<div style="color:${LEVEL_COLORS[e.level] || '#ccc'}">` +
          `<span style="opacity:.6">${e.ts}</span> ${safe}</div>`;
      })
      .join('');
    body.scrollTop = body.scrollHeight;
  }

  function toText() {
    return entries.map((e) => `${e.ts} [${e.level}] ${e.msg}`).join('\n');
  }
  async function copyToClipboard() {
    const text = toText();
    try {
      await navigator.clipboard.writeText(text);
      add('info', '📋 log copied to clipboard');
    } catch (err) {
      add('warn', `clipboard copy failed: ${err.message}`);
    }
  }
  function download() {
    const text = toText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = doc.createElement('a');
    a.href = url;
    a.download = `matrixvtt-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function clear() {
    entries.length = 0;
    savePersisted(win, entries);
    render();
  }

  function add(level, msg) {
    const ts = new Date().toISOString().slice(11, 23);
    entries.push({ ts, level, msg });
    if (entries.length > MAX_ENTRIES) entries.shift();
    savePersisted(win, entries);
    if (visible) render();
  }

  // Capture page lifecycle events. On Firefox mobile the user reports
  // tapping Resume "just refreshes the page" - these listeners give us
  // a breadcrumb trail of which lifecycle transitions fired around the
  // click. `persisted=true` on pageshow means bfcache restore (no
  // re-execution of module init); `persisted=false` means a fresh load.
  win.addEventListener('pageshow', (e) => {
    add('info', `🔄 pageshow persisted=${e.persisted}`);
  });
  win.addEventListener('pagehide', (e) => {
    add('info', `💤 pagehide persisted=${e.persisted}`);
  });
  win.addEventListener('beforeunload', () => {
    add('info', '🚪 beforeunload');
  });
  doc.addEventListener('visibilitychange', () => {
    add('info', `👁 visibilitychange → ${doc.visibilityState}`);
  });
  win.addEventListener('error', (e) => {
    add('error', `💥 window.error ${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`);
  });
  win.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason?.message || String(e.reason);
    add('error', `💥 unhandledrejection ${reason}`);
  });

  function toggle() {
    if (!panel) {
      panel = doc.createElement('div');
      panel.id = 'app-log-panel';
      Object.assign(panel.style, {
        position: 'fixed', top: '40px', right: '10px', left: 'auto',
        width: 'calc(100vw - 20px)', maxWidth: '520px',
        maxHeight: '60vh', display: 'flex', flexDirection: 'column',
        background: 'rgba(0,0,0,.88)', color: '#ccc',
        fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.5',
        padding: '8px', borderRadius: '6px', zIndex: '99999',
      });

      const header = doc.createElement('div');
      Object.assign(header.style, {
        display: 'flex', gap: '6px', marginBottom: '6px',
        flexShrink: '0', alignItems: 'center',
      });
      header.innerHTML = '<span style="flex:1;font-weight:bold;color:#fff;">VTT log</span>';
      const mkBtn = (label, fn) => {
        const b = doc.createElement('button');
        b.type = 'button';
        b.textContent = label;
        Object.assign(b.style, {
          padding: '4px 8px', minHeight: '28px',
          background: '#2a2a2a', color: '#ddd',
          border: '1px solid #555', borderRadius: '4px',
          fontFamily: 'monospace', fontSize: '11px', cursor: 'pointer',
        });
        b.addEventListener('click', fn);
        return b;
      };
      header.appendChild(mkBtn('Copy', copyToClipboard));
      header.appendChild(mkBtn('Download', download));
      header.appendChild(mkBtn('Clear', clear));
      header.appendChild(mkBtn('×', toggle));
      panel.appendChild(header);

      const body = doc.createElement('div');
      body.setAttribute('data-applog-body', '');
      Object.assign(body.style, {
        flex: '1', overflow: 'auto',
        whiteSpace: 'pre-wrap', wordBreak: 'break-all',
      });
      panel.appendChild(body);

      doc.body.appendChild(panel);
    }
    visible = !visible;
    panel.style.display = visible ? 'flex' : 'none';
    if (visible) render();
  }

  win.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'L') toggle();
  });
  if (new URLSearchParams(win.location.search).has('log')) toggle();

  addLogSink(({ level, prefix, message, args }) => {
    // Single unified sink - every logger.{log,warn,error,debug} call
    // funnels through here so the panel and the downloaded log file
    // reflect the complete picture, not just a curated subset.
    const extras = args.length ? ' ' + args.map((a) => {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return a.message;
      try { return JSON.stringify(a); } catch { return String(a); }
    }).join(' ') : '';
    add(level, `[${prefix}] ${message}${extras}`);
  });

  return { add, toggle };
}

// Re-export the canonical HTML escaper - a local copy risks missing the
// single-quote escape needed for HTML attribute context.
export { esc as escapeHtml } from '../utils/domHelpers.js';

export function relativeDate(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
