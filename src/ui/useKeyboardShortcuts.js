/**
 * useKeyboardShortcuts.js - Preact hook for global hotkeys.
 */

import { useEffect } from 'preact/hooks';
import { tinykeys } from 'tinykeys';
import { showKeyboardHelp } from './keyboard-help.js';
import { showCommandPalette } from './command-palette.js';
import { cycleTokenId, announceTokenSelection } from '../map/token-cycle.js';

const TOOL_MAP = {
  v: 'pointer', p: 'pencil', l: 'line', r: 'rect', c: 'circle',
  k: 'cone', m: 'measure', e: 'erase', w: 'wall', t: 'template-circle',
  o: 'light',
};

const GM_ONLY_TOOLS = new Set(['wall', 'light', 'template-circle']);

function _typingInForm() {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
}

export function useKeyboardShortcuts(ui) {
  useEffect(() => {
    // Always-active shortcuts
    const alwaysActive = {
      '$mod+Shift+KeyD': (e) => { e.preventDefault(); ui.toggleDebugMode(); },
      '$mod+KeyZ':       (e) => { e.preventDefault(); ui.undoDrawing(); },
      '$mod+Shift+KeyZ': (e) => { e.preventDefault(); ui.redoDrawing(); },
      '$mod+KeyY':       (e) => { e.preventDefault(); ui.redoDrawing(); },
    };

    // Tool shortcuts: guarded by focus check
    const guarded = (handler) => (e) => {
      if (_typingInForm()) return;
      handler(e);
    };

    const toolBinding = (letter) => guarded(() => {
      const tool = TOOL_MAP[letter];
      if (GM_ONLY_TOOLS.has(tool) && !ui.state?.isGM?.()) return;
      ui.mapRenderer?.setTool(tool);
    });

    const toolShortcuts = Object.fromEntries(
      Object.keys(TOOL_MAP).map((k) => [`Key${k.toUpperCase()}`, toolBinding(k)]),
    );

    toolShortcuts.KeyG = guarded(() => ui.mapRenderer?.enablePingMode());
    // N / Shift+N: cycle token selection on the active map so keyboard
    // users can acquire a token without the pointer (then M to move).
    const cycleSelection = (dir) => guarded(() => {
      const mr = ui.mapRenderer;
      if (!mr) return;
      const isGM = ui.state?.isGM?.() === true;
      const nextId = cycleTokenId({
        tokens: ui.state?.tokens,
        activeMapId: ui.state?.map?.id ?? null,
        currentId: mr.selectedToken ?? null,
        dir,
        isVisible: isGM ? null : (t) => ui.state?.isTokenVisibleToPlayer?.(t) !== false,
      });
      if (!nextId) return;
      mr.setSelectedToken(nextId);
      announceTokenSelection(ui.state?.tokens?.get?.(nextId));
    });
    toolShortcuts.KeyN = cycleSelection(1);
    toolShortcuts['Shift+KeyN'] = cycleSelection(-1);
    toolShortcuts.Slash = guarded((e) => {
      e.preventDefault();
      if (e.shiftKey) showKeyboardHelp(ui);
      else showCommandPalette(ui);
    });

    const unbind = tinykeys(window, { ...alwaysActive, ...toolShortcuts });
    return () => unbind();
  }, [ui]);
}
