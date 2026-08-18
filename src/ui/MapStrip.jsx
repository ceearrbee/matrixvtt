/**
 * MapStrip.jsx - canvas + drawing toolbar + zoom controls, rendered as
 * a horizontal strip inside the conversation-first chat column. The
 * <canvas> node must remain stable across re-renders so map-manager's
 * attached context/Konva stage survives.
 */

import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { MapCanvas } from './MapCanvas.jsx';
import { TokenActionBar } from './TokenActionBar.jsx';
import { useStorageSubscription } from './hooks/use-storage.js';
import { STORAGE_KEYS, UI_MODES, TOOL_GROUPS } from '../utils/constants.js';
import { activeMapIdSignal, tokensSignal } from '../state/signals.js';
import { tablePhaseSignal, gmPrepActiveSignal, activeToolGroupSignal } from '../state/ui-signals.js';
import { clampMapStripSize, useMapStripSize } from '../utils/map-strip-size.js';
import { confirm } from './confirm-dialogs.jsx';
import { isCoarsePointer } from '../utils/pointer.js';
import {
  WallIcon, TemplateIcon, LightIcon, PingIcon, EraseIcon,
  UndoIcon, RedoIcon, TrashIcon, PersonIcon, EyeIcon, FogIcon,
  SelectIcon, PencilIcon, LineToolIcon, RectToolIcon, CircleToolIcon, RulerIcon,
} from './icons/index.jsx';

// Map tool ids -> editorial SVG icons. Every tool renders a stroked
// SVG; the Unicode glyph in the TOOLS tuple survives only as a
// fallback for ids missing here.
const TOOL_ICONS = {
  pointer: SelectIcon,
  pencil: PencilIcon,
  line: LineToolIcon,
  rect: RectToolIcon,
  circle: CircleToolIcon,
  measure: RulerIcon,
  wall: WallIcon,
  light: LightIcon,
  'template-circle': TemplateIcon,
};

// Tool tuple shape: [id, glyph, tooltip-with-shortcut, aria-label, sr-only-name].
// Exported so keyboard-help can render a Map section without duplicating the
// shortcut strings.
export const TOOLS = [
  ['pointer', '↖', 'Select / Move (V)', 'Select/Move tool (V)', 'Select tool'],
  null,
  ['pencil', '✏', 'Freehand pencil (P)', 'Pencil tool (P)', 'Pencil tool'],
  ['line', '╱', 'Line (L)', 'Line tool (L)', 'Line tool'],
  ['rect', '▭', 'Rectangle (R)', 'Rectangle tool (R)', 'Rectangle tool'],
  ['circle', '◯', 'Circle / Aura (C)', 'Circle/Aura tool (C)', 'Circle tool'],
  null,
  ['measure', '📏', 'Measure distance (M)', 'Measure tool (M)', 'Measure tool'],
  null,
];

// Tool groups - only the active group's tools render. Measure lives
// in Navigation (it's a non-destructive "read the map" tool, useful
// alongside pointer in Combat). Switch group via tabs at the top.
const GROUP_TOOL_IDS = Object.freeze({
  [TOOL_GROUPS.NAVIGATION]: new Set(['pointer', 'measure']),
  [TOOL_GROUPS.DRAWING]:    new Set(['pencil', 'line', 'rect', 'circle']),
  [TOOL_GROUPS.GM]:         new Set(['wall', 'light', 'template-circle']),
});

// The GM group is the scene-setup home: walls, lights, templates,
// plus the add-token and fog area actions rendered alongside them.
const GROUP_LABELS = Object.freeze({
  [TOOL_GROUPS.NAVIGATION]: 'Nav',
  [TOOL_GROUPS.DRAWING]:    'Draw',
  [TOOL_GROUPS.GM]:         'Scene',
});

// GM-only tools appended after the base list when the viewer is a GM.
export const GM_TOOLS = [
  ['wall', '🧱', 'Draw sight-blocking wall (W)', 'Wall tool (W)', 'Wall tool'],
  ['light', '💡', 'Place a light source (O)', 'Light tool (O)', 'Light tool'],
  ['template-circle', '🎯', 'Persistent circle template (T)', 'Template circle (T)', 'Template circle tool'],
  null,
];

/**
 * @returns {[boolean, (v: boolean) => void]}
 */
function useShouldShowHelp(_ui) {
  // Help visibility is driven entirely by localStorage - dismiss
  // flips the local state and persists the dismissal. Reads via
  // useStorageSubscription so a dismiss in another tab is reflected
  // here too.
  const [hideFlag, setHideFlag] = useStorageSubscription(STORAGE_KEYS.HIDE_MAP_HELP);
  const showHelp = hideFlag !== '1';
  // Store '1' (hidden) or '0' (visible) - never null, so the reader
  const setShowHelp = (v) => setHideFlag(v ? '0' : '1');
  return [showHelp, setShowHelp];
}

function MapHelp({ onDismiss }) {
  return h('section', { class: 'map-help', 'aria-label': 'Map controls help' }, [
    h('div', { class: 'map-help__title' }, 'Map controls'),
    h('p', { class: 'map-help__copy' }, 'Use the pointer tool to select tokens, drag to move, scroll to zoom, and hold Space while dragging to pan.'),
    h('p', { class: 'map-help__copy' }, [
      'Keyboard support is partial: focus the map, press ',
      h('kbd', null, 'M'),
      ' on a selected token for movement mode, use the arrow keys to move, and press ',
      h('kbd', null, 'Escape'),
      ' to cancel.',
    ]),
    h('button', {
      class: 'dbt dbt--sm map-help__dismiss', type: 'button',
      'aria-label': 'Dismiss map controls help', onClick: onDismiss,
    }, 'Dismiss'),
  ]);
}

function DrawToolbar({ ui }) {
  const [activeTool, setActiveTool] = useState('pointer');
  const [collapsed, setCollapsed] = useState(false);
  const onTool = (e) => {
    const btn = e.target.closest('[data-tool]');
    if (!btn) return;
    ui.setDrawTool?.(btn.dataset.tool);
    setActiveTool(btn.dataset.tool);
  };
  const onToggle = () => setCollapsed((v) => !v);

  const isGM = ui.state?.isGM?.() === true;
  const phase = tablePhaseSignal.value;
  const prepActive = gmPrepActiveSignal.value;
  // The map is always present (it shares the column with the chat), so its
  // toolbar is available in every phase. Combat still locks the toolbar to
  // Navigation (drawing/wall work belongs to prep, not the middle of a turn).
  const isCombat = phase === UI_MODES.COMBAT && !prepActive;
  const userGroup = activeToolGroupSignal.value;
  // Combat locks the toolbar to Navigation regardless of user pick -
  // wall/template/drawing work belongs to prep, not the middle of a turn.
  const activeGroup = isCombat ? TOOL_GROUPS.NAVIGATION : userGroup;
  const groupTabs = isGM
    ? [TOOL_GROUPS.NAVIGATION, TOOL_GROUPS.DRAWING, TOOL_GROUPS.GM]
    : [TOOL_GROUPS.NAVIGATION, TOOL_GROUPS.DRAWING];
  // Build the full tool list once, then filter to the active group.
  const allTools = isGM
    ? [...TOOLS, ...GM_TOOLS.map((t) => (t === null ? null : { tuple: t, kind: 'gm' }))]
    : TOOLS;
  const tools = allTools.filter((t) => {
    if (t === null) return false; // separators only meaningful in flat layout
    const id = Array.isArray(t) ? t[0] : t.tuple[0];
    return GROUP_TOOL_IDS[activeGroup]?.has(id);
  });
  const switchGroup = (g) => {
    if (isCombat) return; // locked
    activeToolGroupSignal.value = g;
  };

  return h('div', {
    class: `draw-toolbar${collapsed ? ' draw-toolbar--collapsed' : ''}`,
    role: 'toolbar', 'aria-label': 'Drawing tools',
  }, [
    h('div', { class: 'draw-toolbar__groups', role: 'tablist', 'aria-label': 'Tool group' },
      groupTabs.map((g) => h('button', {
        key: g,
        type: 'button',
        role: 'tab',
        class: `dtb-group${g === activeGroup ? ' dtb-group--active' : ''}`,
        'data-tool-group': g,
        'aria-selected': String(g === activeGroup),
        'aria-disabled': isCombat ? 'true' : 'false',
        onClick: () => switchGroup(g),
      }, GROUP_LABELS[g])),
    ),
    isCombat && h('span', { class: 'draw-toolbar__lock-note' }, 'Drawing locked during combat'),
    h('button', { class: 'dtb-btn dtb-btn--toggle', id: 'toggle-toolbar', 'aria-label': 'Toggle toolbar', title: 'Toggle toolbar', onClick: onToggle }, [
      '↕ ', h('span', { class: 'sr-only' }, 'Toggle toolbar'),
    ]),
    h('div', { class: 'draw-toolbar__content', onClick: onTool }, [
      ...tools.map((t, i) => {
        const tuple = Array.isArray(t) ? t : t.tuple;
        const kind = Array.isArray(t) ? null : t.kind;
        const Icon = TOOL_ICONS[tuple[0]];
        return h('button', {
          key: tuple[0] || `tool-${i}`,
          class: `dtb-btn${tuple[0] === activeTool ? ' dtb-btn--active' : ''}`,
          'data-tool': tuple[0], 'data-tooltip': tuple[2], 'aria-label': tuple[3], title: tuple[2],
          ...(kind ? { 'data-tool-kind': kind } : {}),
        }, [
          h('span', { class: 'dtb-btn__glyph', 'aria-hidden': 'true' }, Icon ? h(Icon, {}) : tuple[1]),
          h('span', { class: 'sr-only' }, tuple[4]),
        ]);
      }),
      h('button', {
        class: 'dtb-btn', id: 'ping-btn',
        'data-tooltip': 'Ping location (G)', 'aria-label': 'Ping tool (G)', title: 'Ping location (G)',
        onClick: (e) => { e.stopPropagation(); ui.pingLocation?.(); },
      }, [h('span', { class: 'dtb-btn__glyph', 'aria-hidden': 'true' }, h(PingIcon, {})), h('span', { class: 'sr-only' }, 'Ping tool')]),
      ...(activeGroup === TOOL_GROUPS.GM ? [
        h('div', { class: 'dtb-sep', role: 'separator' }),
        h('button', {
          class: 'dtb-btn', 'data-scene-action': 'add-token',
          'aria-label': 'Add a token, then click the map to place it',
          title: 'Add a token, then click the map to place it',
          onClick: (e) => { e.stopPropagation(); ui.beginTokenPlacement?.(); },
        }, [h('span', { class: 'dtb-btn__glyph', 'aria-hidden': 'true' }, h(PersonIcon, {})), h('span', { class: 'sr-only' }, 'Add token')]),
        h('button', {
          class: 'dtb-btn', 'data-scene-action': 'reveal-fog',
          'aria-label': 'Reveal a fog area: drag a rectangle on the map',
          title: 'Reveal a fog area: drag a rectangle on the map',
          onClick: (e) => { e.stopPropagation(); ui.revealFogArea?.(); },
        }, [h('span', { class: 'dtb-btn__glyph', 'aria-hidden': 'true' }, h(EyeIcon, {})), h('span', { class: 'sr-only' }, 'Reveal fog area')]),
        h('button', {
          class: 'dtb-btn', 'data-scene-action': 'hide-fog',
          'aria-label': 'Hide a fog area: drag a rectangle on the map',
          title: 'Hide a fog area: drag a rectangle on the map',
          onClick: (e) => { e.stopPropagation(); ui.hideFogArea?.(); },
        }, [h('span', { class: 'dtb-btn__glyph', 'aria-hidden': 'true' }, h(FogIcon, {})), h('span', { class: 'sr-only' }, 'Hide fog area')]),
      ] : []),
      h('div', { class: 'dtb-sep', role: 'separator' }),
      h('button', {
        class: 'dtb-btn', 'data-tool': 'erase',
        'data-tooltip': 'Erase drawings (E)', 'aria-label': 'Erase tool (E)', title: 'Erase drawings (E)',
      }, [h('span', { class: 'dtb-btn__glyph', 'aria-hidden': 'true' }, h(EraseIcon, {})), h('span', { class: 'sr-only' }, 'Erase')]),
      h('div', { class: 'dtb-sep', role: 'separator' }),
      h('input', {
        type: 'color', id: 'draw-color', value: '#ff4444',
        title: 'Stroke colour', 'aria-label': 'Stroke colour', class: 'dtb-color',
        onChange: (e) => ui.setDrawColor?.(e.target.value),
      }),
      h('select', {
        id: 'draw-width', title: 'Line width', 'aria-label': 'Line width', class: 'dtb-width',
        onChange: (e) => ui.setDrawWidth?.(e.target.value),
      }, [
        h('option', { value: '2' }, 'Thin'),
        h('option', { value: '3', selected: true }, 'Normal'),
        h('option', { value: '6' }, 'Thick'),
      ]),
      h('div', { class: 'dtb-sep', role: 'separator' }),
      h('button', {
        class: 'dtb-btn', 'data-action': 'undo-drawing',
        'aria-label': 'Undo last drawing stroke', title: 'Undo last stroke (Ctrl+Z)',
        onClick: (e) => { e.stopPropagation(); ui.undoDrawing?.(); },
      }, [h('span', { class: 'dtb-btn__glyph', 'aria-hidden': 'true' }, h(UndoIcon, {})), h('span', { class: 'sr-only' }, 'Undo')]),
      h('button', {
        class: 'dtb-btn', 'data-action': 'redo-drawing',
        'aria-label': 'Redo drawing stroke', title: 'Redo stroke (Ctrl+Y)',
        onClick: (e) => { e.stopPropagation(); ui.redoDrawing?.(); },
      }, [h('span', { class: 'dtb-btn__glyph', 'aria-hidden': 'true' }, h(RedoIcon, {})), h('span', { class: 'sr-only' }, 'Redo')]),
      h('button', {
        class: 'dtb-btn dtb-btn--danger', id: 'clear-drawings',
        'aria-label': 'Clear all drawings', title: 'Clear all drawings',
        onClick: (e) => {
          e.stopPropagation();
          confirm('This deletes every drawing on the map, for everyone. This can\'t be undone.',
            () => ui.clearDrawings?.(),
            { title: 'Clear drawings', confirmText: 'Clear all', confirmClass: 'dbt--danger', id: 'confirm-clear-drawings' });
        },
      }, [h('span', { class: 'dtb-btn__glyph', 'aria-hidden': 'true' }, h(TrashIcon, {})), h('span', { class: 'sr-only' }, 'Clear')]),
    ]),
  ]);
}

function MapEmptyPlaceholder({ ui }) {
  const isGM = ui.state?.isGM?.() === true;
  return h('div', { class: 'map-empty', role: 'status' }, [
    h('span', { class: 'eyebrow' }, 'The table'),
    h('h2', { class: 'editorial-heading editorial-heading--lg' }, 'No active map'),
    h('p', { class: 'editorial-body map-empty__copy' },
      isGM
        ? 'Open the maps panel to create or select a battle map. Players see the same room state as soon as you switch.'
        : 'Waiting for the GM to load a map. Other surfaces - Notes, Pages, the scene forum - are usable while you wait.'),
    isGM && h('button', {
      class: 'dbt btn-primary',
      onClick: () => ui.openMapsPanel?.(),
    }, 'Open maps panel'),
  ]);
}

// 360px gives portrait-oriented dungeon maps enough room to auto-fit
// at a readable zoom on first open. The drag handle still lets users
// resize within [80px, 60vh].
const DEFAULT_STRIP_HEIGHT = 360;
const COLLAPSED_CHROME_HEIGHT = 32;

export function MapStrip({ ui }) {
  const [showHelp, setShowHelp] = useShouldShowHelp(ui);
  const onDismiss = () => { ui.dismissMapHelp?.(); setShowHelp(false); };

  // Subscribing here keeps the empty-state in sync with map changes
  // (GM picks a different map, room sync delivers a fresh activeMapId).
  const activeMapId = activeMapIdSignal.value;
  const hasMap = !!activeMapId && !!ui.state?.map;

  // Teaching cue for a fresh scene: a loaded map with no tokens shows
  // the GM where token placement lives instead of a blank canvas.
  const tokens = tokensSignal.value;
  const isGM = ui.state?.isGM?.() === true;
  const mapHasTokens = [...(tokens?.values?.() ?? [])]
    .some((t) => t.map_id === activeMapId);
  const showTokenHint = hasMap && isGM && !mapHasTokens;

  const userId = ui?.widgetManager?.userId ?? null;
  const roomId = ui?.widgetManager?.roomId ?? null;
  const [storedHeight, persistHeight] = useMapStripSize(userId, roomId);
  // Transient drag height - set during pointermove so the strip
  // resizes responsively, then committed to storage on pointerup.
  const [dragHeight, setDragHeight] = useState(null);
  // Remember the last non-collapsed height so the chevron toggle can
  // restore it without re-reading the (just-cleared) storage value.
  const lastExpandedRef = useRef(storedHeight && storedHeight > 0 ? storedHeight : DEFAULT_STRIP_HEIGHT);
  if (storedHeight != null && storedHeight > 0) lastExpandedRef.current = storedHeight;

  const effectiveHeight = dragHeight != null
    ? dragHeight
    : storedHeight != null
      ? storedHeight
      : DEFAULT_STRIP_HEIGHT;
  const collapsed = effectiveHeight === 0;

  const dragCleanupRef = useRef(null);
  useEffect(() => () => {
    if (dragCleanupRef.current) dragCleanupRef.current();
  }, []);

  const onHandlePointerDown = (e) => {
    if (e.button !== 0) return;
    // Defensive: a second pointerdown before the previous drag's
    // pointerup arrived would otherwise pile up listeners.
    if (dragCleanupRef.current) dragCleanupRef.current();

    const startY = e.clientY;
    const startHeight = effectiveHeight > 0 ? effectiveHeight : lastExpandedRef.current;
    const target = e.currentTarget;
    try { target.setPointerCapture?.(e.pointerId); } catch { /* not supported */ }
    target.classList.add('map-strip__resize--dragging');
    let lastClamped = startHeight;
    const onMove = (ev) => {
      const next = clampMapStripSize(startHeight + (ev.clientY - startY));
      if (next != null) {
        lastClamped = next;
        setDragHeight(next);
      }
    };
    const cleanup = (commit) => {
      target.classList.remove('map-strip__resize--dragging');
      try { target.releasePointerCapture?.(e.pointerId); } catch { /* not supported */ }
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      dragCleanupRef.current = null;
      setDragHeight(null);
      if (commit) persistHeight(lastClamped);
    };
    const onUp = () => cleanup(true);
    dragCleanupRef.current = () => cleanup(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const onToggleCollapse = () => {
    if (collapsed) persistHeight(lastExpandedRef.current);
    else persistHeight(0);
  };

  return h('main', {
    id: 'main-content',
    class: `map-strip map-container${collapsed ? ' map-strip--collapsed' : ''}`,
    role: 'main', 'aria-label': 'Game map',
    style: `--map-strip-height: ${collapsed ? COLLAPSED_CHROME_HEIGHT : effectiveHeight}px;`,
  }, [
    h('button', {
      key: 'collapse',
      type: 'button',
      class: 'map-strip__collapse',
      'aria-label': collapsed ? 'Expand map strip' : 'Collapse map strip',
      'aria-expanded': String(!collapsed),
      title: collapsed ? 'Expand map strip' : 'Collapse map strip',
      onClick: onToggleCollapse,
    }, collapsed ? '▾' : '▴'),
    showHelp && hasMap ? h(MapHelp, { key: 'help', onDismiss }) : null,
    !hasMap ? h(MapEmptyPlaceholder, { key: 'empty', ui }) : null,
    showTokenHint && h('div', { key: 'token-hint', class: 'map-hint', role: 'status' },
      isCoarsePointer()
        ? 'No tokens on this map yet. Open the Scene tab of the toolbar and press Token, or long-press a square.'
        : 'No tokens on this map yet. Open the Scene tab of the toolbar and press Token, or right-click a square.'),
    h(TokenActionBar, { key: 'token-bar', ui }),
    h(MapCanvas, { key: 'canvas', ui }),
    h('p', { key: 'desc', id: 'map-canvas-desc', class: 'sr-only' },
      'Drag tokens to move them. Scroll or pinch to zoom. Space+drag to pan. Press M on a selected token to enter movement mode, then arrow keys to move. Press Escape to cancel.'),
    h(DrawToolbar, { key: 'toolbar', ui }),
    h('div', { key: 'controls', class: 'map-controls', 'aria-label': 'Map zoom controls' }, [
      h('button', { id: 'zoom-in', 'aria-label': 'Zoom in', title: 'Zoom in', onClick: () => ui.zoomIn?.() }, [
        h('span', { class: 'map-controls__word' }, 'Zoom '),
        h('span', { class: 'map-controls__glyph', 'aria-hidden': 'true' }, '+'),
      ]),
      h('button', { id: 'zoom-out', 'aria-label': 'Zoom out', title: 'Zoom out', onClick: () => ui.zoomOut?.() }, [
        h('span', { class: 'map-controls__word' }, 'Zoom '),
        h('span', { class: 'map-controls__glyph', 'aria-hidden': 'true' }, '−'),
      ]),
    ]),
    h('div', { key: 'inspector', id: 'token-inspector', class: 'token-inspector', style: 'display: none;' }),
    h('div', {
      key: 'resize',
      class: 'map-strip__resize',
      role: 'separator',
      'aria-orientation': 'horizontal',
      'aria-label': 'Resize map strip',
      onPointerDown: onHandlePointerDown,
    }),
  ]);
}
