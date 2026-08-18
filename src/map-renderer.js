/**
 * MapRenderer - Konva-based canvas orchestrator.
 *
 * Owns the Konva Stage and Layers, and bridges StateManager signals
 * to imperative Konva mutations. Handles high-frequency rendering
 * (tokens, drawings) with frame-based batching.
 */

import Konva from 'konva';
import { EVENT_TYPES, ENTITY_TYPES } from './utils/constants.js';
import { logger } from './utils/logger.js';
import { readThemeColors } from './map/theme-colors.js';
import {
  tokensSignal, fogSignal, activeMapIdSignal, drawingsSignal,
  wallsSignal, templatesSignal, pinsSignal, mapsSignal,
} from './state/signals.js';
import { effect } from '@preact/signals';
import { createStage, destroyStage, resizeStage, syncStageTransform, fitToViewport } from './map/stage.js';
import { setupLayers } from './map/setup-layers.js';
import { setupTools, buildStroke } from './map/input/tools.js';
import { cellToPixel } from './utils/grid-coords.js';
import { setupPanZoom, zoomAround, ZOOM_STEP } from './map/input/pan-zoom.js';
import { setupKeyboard } from './map/input/keyboard.js';
import { attachMapActions } from './map/map-actions-wiring.js';
import { panToToken } from './map/layers/tokens.js';
import { FrameBatcher } from './state/YjsSignalBridge.js';
import { DEFAULT_PING_COLOR } from './utils/ui-constants.js';

export const MAP_RENDERER_DEFAULTS = {
  drawColor: '#ff4444',
  drawWidth: 3,
};

export class MapRenderer {
  /**
   * @param {HTMLElement} host
   * @param {import('./state/StateManager').StateManager} state
   */
  constructor(host, state) {
    this.host = host;
    this.canvas = host;
    this.state = state;

    /** @type {import('konva').default.Stage | null} */
    this.stage = null;
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.activeTool = 'pointer';
    this.selectedToken = null;

    this.areaSelectionMode = null;
    this.areaSelectionStart = null;
    this.areaSelectionCurrent = null;

    this._touchDragPreview = null;
    this._layerSyncers = [];
    // Subset of _layerSyncers whose output depends on token position, used
    // for drag frames. Populated by setupLayers().
    this._dragLayerSyncers = [];
    this._layerDisposers = [];

    // Image cache for getOrLoadImage(); reads `mr._tokenImages.has(url)`
    // so it must exist before any layer with an image_url syncs.
    /** @type {Map<string, HTMLImageElement>} */
    this._tokenImages = new Map();

    // Auto-fit bookkeeping. `_lastFittedMapId` makes the fit effect
    // re-run only when the active map id changes (not on every token
    // move). `_userFramedViewport` flips true after any user pan / zoom
    // so resize() preserves their framing instead of clobbering it.
    this._lastFittedMapId = null;
    this._userFramedViewport = false;

    // Populated by setupLayers() - declared here so JSDoc / tsc see
    // them as instance fields rather than dynamic any.
    /** @type {import('konva').default.Layer | null} */
    this._tokensLayer = null;
    /** @type {(() => void) | null} */
    this._disposeTokensLayer = null;
    /** @type {{ addPing: (x: number, y: number, color?: string) => void } | null} */
    this._pingsApi = null;
    /** @type {{ addBubble: (x: number, y: number, body: string) => void, layer: any, destroy: () => void } | null} */
    this._speechBubblesApi = null;
    /** @type {(() => void) | null} */
    this._syncTokensLayer = null;

    this._colors = readThemeColors();
    attachMapActions(this);
    createStage(this);
    setupLayers(this);
    this.resize();
    this._disposeTools = setupTools(this);
    this._disposePanZoom = setupPanZoom(this);
    this._disposeKeyboard = setupKeyboard(this);

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);

    const batcher = new FrameBatcher(() => this.render());
    this._dragBatcher = new FrameBatcher(() => this.renderDragFrame());

    let primed = false;
    this._disposeEffect = effect(() => {
      // Deep observation for high-frequency state
      Array.from(tokensSignal.value.values());
      drawingsSignal.value;

      // Surface level for static state
      fogSignal.value; activeMapIdSignal.value;
      wallsSignal.value; templatesSignal.value;
      pinsSignal.value; mapsSignal.value;

      if (primed) batcher.request();
      else primed = true;
    });

    this._onThemeChange = () => { this._colors = readThemeColors(); this.render(); };
    window.addEventListener('vtt:theme-change', this._onThemeChange);

    this._disposeFitEffect = effect(() => {
      const id = activeMapIdSignal.value;
      const maps = mapsSignal.value;
      if (id && id !== this._lastFittedMapId && maps.get(id)) {
        this._lastFittedMapId = id;
        this._userFramedViewport = false;
        fitToViewport(this);
      }
    });

    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => this.resize());
      this._resizeObserver.observe(host);
    }
  }

  destroy() {
    window.removeEventListener('vtt:theme-change', this._onThemeChange);
    window.removeEventListener('resize', this._onResize);
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._disposeFitEffect?.();
    this._disposeEffect?.();
    this._disposeTools?.();
    this._disposePanZoom?.();
    this._disposeKeyboard?.();
    this._disposeTokensLayer?.();
    for (const d of this._layerDisposers) d();
    this._layerDisposers = [];
    this.cancelCombatFrame();
    destroyStage(this);
  }

  updateThemeColors() { this._colors = readThemeColors(); }

  /** Manually re-frame the active map (resets the user-framed flag). */
  fitToViewport() {
    this._userFramedViewport = false;
    fitToViewport(this);
  }

  resize() {
    resizeStage(this);
    if (!this._userFramedViewport) fitToViewport(this);
    this.render();
  }

  render() {
    syncStageTransform(this);
    this._syncTokensLayer?.();
    for (const s of this._layerSyncers) s();
  }

  /**
   * Coalesce drag-driven repaints to one per animation frame. Pointer
   * events fire faster than frames on high-polling-rate mice, so a
   * per-event sync did redundant work the compositor never showed.
   */
  requestDragFrame() {
    this._dragBatcher.request();
  }

  /**
   * Repaint only what a moving token can change: the token groups
   * themselves plus the layers that read token positions (lights,
   * transient overlays, fog vision cones). Walls, grid, map background,
   * drawings, templates and pins are untouched by a drag, so re-syncing
   * them per frame was the dominant cost of dragging on a busy map.
   */
  renderDragFrame() {
    syncStageTransform(this);
    this._syncTokensLayer?.();
    for (const s of this._dragLayerSyncers) s();
  }

  // Bridge for local drawing preview (src/map/layers/drawings.js)
  _buildStroke(start, end, pencilPoints) {
    return buildStroke(this, start, end, pencilPoints);
  }

  setTool(name) { this.activeTool = name; this.render(); }

  /**
   * Set the currently-selected token. Mirrors the id into:
   *   - this.selectedToken (canvas selection ring),
   *   - this.state.selectedToken (signal-backed; wakes Sheet/NPC panels),
   *   - this.state.selectedCharacterId / selectedNPCId depending on the
   *     token's type - so the sheet panels' direct signal reads pick
   *     up the change without needing a tab-switch.
   * Clearing (id=null) clears all three signal-backed fields.
   */
  setSelectedToken(id) {
    this.selectedToken = id;
    if (this.state) {
      this.state.selectedToken = id;
      const token = id ? this.state.tokens?.get?.(id) : null;
      if (token?.sheet_id) {
        if (token.type === ENTITY_TYPES.NPC) {
          this.state.selectedNPCId = token.sheet_id;
        } else {
          this.state.selectedCharacterId = token.sheet_id;
        }
      } else if (!id) {
        // Explicit clear: drop both selection ids so neither sheet
        // sticks on the previously-selected entity.
        this.state.selectedCharacterId = null;
        this.state.selectedNPCId = null;
      }
    }
    this.render();
  }

  panToToken(tokenId) { panToToken(this, tokenId); }

  zoomIn()  { this._zoomAroundCentre(ZOOM_STEP); }
  zoomOut() { this._zoomAroundCentre(1 / ZOOM_STEP); }

  _zoomAroundCentre(factor) {
    if (!this.stage) return;
    zoomAround(this, this.stage.width() / 2, this.stage.height() / 2, factor);
  }

  /**
   * Drive the active-combatant turn-ring pulse without re-rendering
   * the whole map. The previous implementation was an unconditional
   * 60 fps RAF that called `this.render()` (and therefore every
   * layer's sync()), which dominated the per-frame cost in busy
   * combats. Now: a Konva.Animation that only mutates the active
   * turnRing's opacity and triggers a tokens-layer batchDraw -
   * everything else (map-bg, walls, drawings, fog, …) sits idle.
   */
  scheduleCombatFrame() {
    if (this._combatAnim) return;
    const layer = this._tokensLayer;
    if (!layer) return;
    const findActiveTurnRing = () => {
      const init = this.state?.initiative;
      if (!init?.active) return null;
      const id = init.order?.[init.current_index]?.token_id;
      if (!id) return null;
      const anyLayer = /** @type {any} */ (layer);
      const group = this._syncTokensLayer ? anyLayer.findOne((n) => n.attrs?.['data-token-id'] === id) : null;
      if (group) return /** @type {any} */ (group).findOne('.turnRing');
      const children = layer.getChildren();
      for (const c of children) {
        const turn = /** @type {any} */ (c).findOne?.('.turnRing');
        if (turn?.visible()) return turn;
      }
      return null;
    };
    this._combatAnim = new Konva.Animation((frame) => {
      const ring = findActiveTurnRing();
      if (!ring || !ring.visible()) return false; // skip layer batchDraw
      const t = frame?.time ?? performance.now();
      // Same pulse formula getActiveCombatantRingAlpha used.
      ring.opacity(0.7 + 0.3 * Math.cos((2 * Math.PI * t) / 1500));
    }, layer);
    this._combatAnim.start();
  }
  cancelCombatFrame() {
    if (this._combatAnim) { this._combatAnim.stop(); this._combatAnim = null; }
  }

  cancelAreaSelection() {
    this.areaSelectionMode = this.areaSelectionStart = this.areaSelectionCurrent = null;
    this.render();
  }

  addPing(x, y, color) { this._pingsApi?.addPing(x, y, color || DEFAULT_PING_COLOR); }

  /**
   * Show a transient chat-bubble above a token, ~3.5s with a quick
   * fade. Called from chat-send's local echo and the sync-echo
   * _onChat handler. No-op if the token can't be located on the
   * current map (e.g. token belongs to a different map, or its
   * grid coordinates are missing).
   */
  showSpeechBubble(tokenId, body) {
    if (!this._speechBubblesApi) return;
    const token = this.state.tokens?.get?.(tokenId);
    if (!token) return;
    const map = this.state.map;
    if (!map) return;
    if (typeof token.col !== 'number' || typeof token.row !== 'number') return;
    const gridType = map.grid_type || 'square';
    const size = token.size || 1;
    let x;
    let y;
    if (size === 1) {
      const p = cellToPixel(map, token.col, token.row, gridType);
      x = p.x;
      y = p.y;
    } else {
      const cellPx = map.cell_px || 40;
      x = (token.col + size / 2) * cellPx;
      y = (token.row + size / 2) * cellPx;
    }
    this._speechBubblesApi.addBubble(x, y, body);
  }

  broadcastPing(x, y, color) {
    const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_PING_COLOR;
    this.addPing(x, y, safeColor);
    const map = this.state.map;
    if (!map || !this.state.sendRoomEvent) return;
    const x_frac = Math.round((x / (map.width_cells * map.cell_px)) * 10000);
    const y_frac = Math.round((y / (map.height_cells * map.cell_px)) * 10000);
    this.state.sendRoomEvent(EVENT_TYPES.PING, {
      x_frac, y_frac, color: safeColor, ts: Date.now(),
    }).catch((err) => logger.warn('MapRenderer', 'broadcastPing send failed', err));
  }
}
