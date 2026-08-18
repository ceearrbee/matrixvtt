/**
 * lifecycle-init.js - UIController constructor body, destroy, and
 * window event-listener setup/teardown.
 */

import { esc } from '../utils/domHelpers.js';
import { DiceRoller } from '../dice-roller.js';
import { isWhisperVisible } from './chat-helpers.js';
import { VTT_EVENTS } from '../utils/constants.js';
import { registerStateEffects } from './state-effects.js';
import { startSnapshotInterval } from '../utils/state-snapshot.js';
import { startSnapshotScheduler } from '../state/snapshot-scheduler.js';
import { wireSyncProgress, setSyncPhase } from './sync/sync-progress.js';
import { setupEventHandlers } from './event-handlers.js';
import { wireOfflineBanner } from './sync/offline-banner.js';
import { syncOkSignal, queueCountSignal } from '../state/ui-signals.js';
import {
  hydratePhase, hydrateIconRailDrawer, hydrateLayoutMode,
  bindPhaseToInitiative, bindAutoTabToMode, bindAutoDrawerToMode,
  unbindPhaseFromInitiative, unbindAutoTabFromMode, unbindAutoDrawerFromMode,
} from './ui-mode.js';
import {
  formatSayLogBody, formatEmoteLogBody, renderChatBody, isLongBody,
  formatSceneRootBody,
} from './chat-log-format.js';
import { restoreActiveScene } from './scene-mode.js';
import { closeSetupWizard } from './SetupWizard.jsx';
import { logger } from '../utils/logger.js';

export function initUIController(ui, state, widgetManager, chat) {
  ui.state = state;
  ui.widgetManager = widgetManager;
  ui.chat = chat;
  ui.mapRenderer = null;
  ui.diceRoller = new DiceRoller(state);

  // Activity log (local, not synced)
  ui.activityLog = []; // [{icon, html, text, ts}]
  ui._logFilter = 'all'; // 'all'|'chat'|'dice'|'combat'|'map'
  ui._logSearch = '';
  ui._logLoadingHistory = false;
  ui._seenLogEventIds = new Set();

  // Turn timer (local)
  ui._turnStartMs = null;
  ui._turnTimerInterval = null;

  // Display name sync - last name we set so we can skip redundant calls
  ui._lastSetDisplayName = null;
  ui._syncDisplayNameTimer = null;

  _bindHandlers(ui);
  _setupCoreListeners(ui);
  setupSyncListeners(ui);
  _setupChatListeners(ui);
  chat?.hydrateFromTimeline?.(ui);

  restoreActiveScene(widgetManager?.roomId);
  setupEventHandlers(ui);
  ui._disposeStateEffects = registerStateEffects(ui);

  // Periodic localStorage snapshot of campaign state. Best-effort -
  // never blocks user actions; silently no-ops if storage quota is
  // exceeded. Recovery surface lives in Settings → Reload-from-server
  // (already shipped) and the upcoming "Restore from snapshot" action.
  const userId = widgetManager?.userId;
  const roomId = widgetManager?.roomId;
  if (userId && roomId) {
    ui._disposeSnapshot = startSnapshotInterval(state, userId, roomId);
  }
  // One-shot self-heal: if a previous wizard run hit a 429 partway
  // through publishing the snapshot, the room ended up with chunks
  // 0..N-1 in place but no complete snapshot. A lax probe would report
  // that as 'present' and suppress the wizard - leaving the GM stranded
  // in a room with no map / no entities. The probe is strict, AND we proactively republish on
  // boot if the doc has content but the snapshot is incomplete /
  // missing. 5s debounce lets the initial /sync settle so the local
  // Yjs doc is fully populated by the time we encode it.
  const _republishTimer = setTimeout(async () => {
    try {
      const { republishSnapshotIfMissing } = await import('../state/yjs-snapshot-publish.js');
      await republishSnapshotIfMissing(state);
    } catch (err) {
      // best-effort; log + carry on
      logger.warn('YjsSnapshot', `auto-republish failed: ${err?.message || err}`);
    }
  }, 5000);
  ui._disposeRepublishTimer = () => clearTimeout(_republishTimer);
  // Unified sync-progress bar: fold connect / queue-drain phases into one
  // surface (history + live-save phases report directly).
  ui._disposeSyncProgress = wireSyncProgress();
  // Keep the durable snapshot fresh so live edits survive reload (the
  // update events roll off the sync window). GM-gated + idempotent inside.
  ui._disposeSnapshotScheduler = startSnapshotScheduler(state, {
    onState: (active) => setSyncPhase('live', active ? { label: 'Saving…', total: 0 } : null),
  });
  if (userId && roomId) {
    hydratePhase(userId, roomId, ui.state.isGM());
    hydrateIconRailDrawer(userId, roomId);
    hydrateLayoutMode(userId);
    bindPhaseToInitiative(userId, roomId);
    bindAutoTabToMode(ui);
    bindAutoDrawerToMode(ui);
  }
}

function _bindHandlers(ui) {
  ui.handleDiceRollResult = ui.handleDiceRollResult.bind(ui);
  ui.handleDamage = ui.handleDamage.bind(ui);
  ui.handleHeal = ui.handleHeal.bind(ui);
  ui.handleViewSheet = ui.handleViewSheet.bind(ui);
}

function _setupCoreListeners(ui) {
  ui._onError = (e) => {
    ui._toast(/** @type {CustomEvent} */ (e).detail?.message || 'An error occurred');
  };
  ui._onSessionReset = () => {
    if (ui.state._cleaningUp) return;
    closeSetupWizard();
    ui.render();
  };

  window.addEventListener(VTT_EVENTS.DICE_ROLL_RESULT, ui.handleDiceRollResult);
  window.addEventListener(VTT_EVENTS.DAMAGE, ui.handleDamage);
  window.addEventListener(VTT_EVENTS.HEAL, ui.handleHeal);
  window.addEventListener(VTT_EVENTS.VIEW_SHEET, ui.handleViewSheet);
  window.addEventListener(VTT_EVENTS.ERROR, ui._onError);
  window.addEventListener(VTT_EVENTS.SESSION_RESET, ui._onSessionReset);
}

/**
 * Seed syncOkSignal from the api's current health instead of assuming
 * false. The client's initial sync completes on the discovery screen,
 * long before the VTT shell mounts - its one-shot SYNC_RECOVERED event
 * is gone by the time the listeners below register, so without this
 * pull the chip shows "Reconnecting…" forever on a healthy session.
 */
export function seedSyncOk(ui) {
  syncOkSignal.value = !!ui?.widgetManager?.getApi?.()?.isSyncHealthy?.();
}

export function setupSyncListeners(ui) {
  ui._rateLimitSeconds = 0;
  ui._rateLimitInterval = null;
  // Two planes feed the banner (matrix retry queue + yjs pending
  // buffer); track them separately so one source's event can't clobber
  // the other's count.
  ui._queueCounts = { matrix: 0, yjs: 0 };
  queueCountSignal.value = 0;
  seedSyncOk(ui);

  const sumCounts = () =>
    Object.values(ui._queueCounts).reduce((total, n) => total + n, 0);

  ui._onRateLimited = (e) => {
    ui._rateLimitSeconds = Math.ceil((/** @type {CustomEvent} */ (e).detail?.retryAfterMs ?? 5000) / 1000);
    ui._updateSyncBanner();
    ui._refreshApiStatus();
  };
  ui._onQueuePending = (e) => {
    const detail = /** @type {CustomEvent} */ (e).detail ?? {};
    ui._queueCounts[detail.source ?? 'matrix'] = detail.count ?? 0;
    queueCountSignal.value = sumCounts();
    ui._updateSyncBanner();
    ui._refreshApiStatus();
  };
  ui._onQueueEmpty = (e) => {
    const source = /** @type {CustomEvent} */ (e)?.detail?.source;
    if (source) ui._queueCounts[source] = 0;
    else ui._queueCounts = { matrix: 0, yjs: 0 };
    queueCountSignal.value = sumCounts();
    ui._updateSyncBanner();
    ui._refreshApiStatus();
  };
  // Header subscribes to syncOkSignal and re-renders the pill reactively
  // - no imperative DOM update needed.
  ui._onSyncError = () => { syncOkSignal.value = false; };
  ui._onSyncRecovered = () => { syncOkSignal.value = true; };

  window.addEventListener(VTT_EVENTS.RATE_LIMITED, ui._onRateLimited);
  window.addEventListener(VTT_EVENTS.QUEUE_PENDING, ui._onQueuePending);
  window.addEventListener(VTT_EVENTS.QUEUE_EMPTY, ui._onQueueEmpty);
  window.addEventListener(VTT_EVENTS.SYNC_ERROR, ui._onSyncError);
  window.addEventListener(VTT_EVENTS.SYNC_RECOVERED, ui._onSyncRecovered);

  ui._disposeOfflineBanner = wireOfflineBanner();
}

function _setupChatListeners(ui) {
  ui._onChat = (e) => {
    const detail = /** @type {CustomEvent} */ (e).detail;
    const {
      sender, body, speakAsTokenId, historical, whisperTo, eventId, threadOf,
      format, formatted_body, isSceneRoot, sceneTitle,
    } = detail;
    const msgtype = detail.msgtype || 'm.text';
    const myUserId = ui.widgetManager?.userId;
    if (!isWhisperVisible({ sender, whisper_to: whisperTo }, myUserId)) return;

    const tokenId = speakAsTokenId || ui._findTokenForSender(sender);
    const token = tokenId ? ui.state.tokens.get(tokenId) : null;
    const displayName = token?.name ?? sender?.split(':')[0]?.replace('@', '') ?? sender ?? '?';
    // Only treat the resolved token as a persona when the event actually
    // carried `com.vtt.speak_as_token`. The viewer-side fallback that
    // maps a Matrix sender → owned token isn't a persona claim and must
    // not trigger the body-already-prefixed dedup.
    const personaName = speakAsTokenId ? (token?.name ?? null) : null;
    const logOpts = {
      eventId: eventId ?? null, sender, threadOf: threadOf ?? null, msgtype,
      isSceneRoot: !!isSceneRoot, sceneTitle: sceneTitle ?? null,
      long: isLongBody(body),
    };
    const fmt = { format, formatted_body };

    if (isSceneRoot) {
      ui._log('🎬', formatSceneRootBody(sceneTitle, body, fmt), logOpts);
    } else if (whisperTo) {
      const toDisplay = whisperTo.split(':')[0].replace('@', '');
      ui._log('🔒', `<b>${esc(displayName)}</b> whispers to <b>${esc(toDisplay)}</b>: ${esc(body)}`, logOpts);
    } else if (msgtype === 'm.emote') {
      ui._log('💭', formatEmoteLogBody(displayName, body, personaName, fmt), logOpts);
      if (!historical && tokenId && ui.mapRenderer?.showSpeechBubble) ui.mapRenderer.showSpeechBubble(tokenId, body);
    } else if (msgtype === 'm.notice') {
      // OOC: dim/italic styling, no speech bubble (out-of-character is not
      // a thing a token says).
      ui._log('📢', `<span class="log-entry--ooc">((OOC)) <b>${esc(displayName)}</b>: ${renderChatBody(body, fmt)}</span>`, logOpts);
    } else {
      ui._log('💬', formatSayLogBody(displayName, body, personaName, fmt), logOpts);
      if (!historical && tokenId && ui.mapRenderer?.showSpeechBubble) ui.mapRenderer.showSpeechBubble(tokenId, body);
    }
    // Mirror live (non-historical) chat to the polite live region so
    // screen-reader users hear incoming messages without polling Log.
    if (!historical) {
      const region = document.getElementById('vtt-sr-announcements');
      if (region) region.textContent = `${displayName}: ${body}`;
    }
  };
  window.addEventListener(VTT_EVENTS.CHAT_MESSAGE, ui._onChat);
}

export function destroyUI(ui) {
  _removeCoreListeners(ui);
  _removeSyncListeners(ui);
  window.removeEventListener(VTT_EVENTS.CHAT_MESSAGE, ui._onChat);

  ui._disposeStateEffects?.();
  ui._disposeStateEffects = null;
  ui._disposeSnapshot?.();
  ui._disposeSnapshot = null;
  ui._disposeRepublishTimer?.();
  ui._disposeRepublishTimer = null;
  ui._disposeSnapshotScheduler?.();
  ui._disposeSnapshotScheduler = null;
  ui._disposeSyncProgress?.();
  ui._disposeSyncProgress = null;

  unbindPhaseFromInitiative();
  unbindAutoTabFromMode();
  unbindAutoDrawerFromMode();

  clearInterval(ui._rateLimitInterval);
  clearInterval(ui._debugBarInterval);
  ui._debugBarInterval = null;
  // Turn timer can be running when a user leaves mid-combat; the
  // interval would otherwise outlive the session and poll a removed
  // #turn-timer DOM node every second.
  if (ui._turnTimerInterval) clearInterval(ui._turnTimerInterval);
  ui._turnTimerInterval = null;
  clearTimeout(ui._syncDisplayNameTimer);

  ui._seenLogEventIds?.clear();

  ui.mapRenderer?.destroy();
}

function _removeCoreListeners(ui) {
  window.removeEventListener(VTT_EVENTS.DICE_ROLL_RESULT, ui.handleDiceRollResult);
  window.removeEventListener(VTT_EVENTS.DAMAGE, ui.handleDamage);
  window.removeEventListener(VTT_EVENTS.HEAL, ui.handleHeal);
  window.removeEventListener(VTT_EVENTS.VIEW_SHEET, ui.handleViewSheet);
  window.removeEventListener(VTT_EVENTS.ERROR, ui._onError);
  window.removeEventListener(VTT_EVENTS.SESSION_RESET, ui._onSessionReset);
  ui._unbindKeyboardShortcuts?.();
}

function _removeSyncListeners(ui) {
  window.removeEventListener(VTT_EVENTS.RATE_LIMITED, ui._onRateLimited);
  window.removeEventListener(VTT_EVENTS.QUEUE_PENDING, ui._onQueuePending);
  window.removeEventListener(VTT_EVENTS.QUEUE_EMPTY, ui._onQueueEmpty);
  window.removeEventListener(VTT_EVENTS.SYNC_ERROR, ui._onSyncError);
  window.removeEventListener(VTT_EVENTS.SYNC_RECOVERED, ui._onSyncRecovered);

  ui._disposeOfflineBanner?.();
  ui._disposeOfflineBanner = null;
}
