/**
 * chat-integrator.js - Matrix chat <-> VTT bridge.
 *
 * Owns the announcement-setting state (persisted to localStorage)
 * and the `matrix:timeline-event` listener. Incoming events are
 * dispatched to `chat/timeline-intake.js`; outbound announcements
 * and dice-roll posts live in `chat/announcements.js`; chat
 * `/roll` parsing and execution in `chat/dice-command.js`.
 */

import { VTTError, ErrorType, showErrorNotification } from './utils/errorHandling.js';
import { logger } from './utils/logger.js';
import { STORAGE_KEYS, EVENT_TYPES } from './utils/constants.js';
import { handleTimelineEvent } from './chat/timeline-intake.js';
import { backfillRecentHistory } from './ui/log-panel.js';
import {
  postDiceRollToChat, announceDamage, announceHeal, announceCombat,
  announceMapChange, announceInitiativeOrder, announceTurn, announceMessage,
} from './chat/announcements.js';
import {
  parseDiceRollCommand, parseDiceNotation, executeDiceRollFromChat,
  getCharacterNameForUser,
} from './chat/dice-command.js';

const DEFAULT_ANNOUNCEMENTS = { damage: true, combat: true, mapChanges: true, hideGMActions: true };

function _loadAnnouncements(userId) {
  const userKey = userId ? `${STORAGE_KEYS.ANNOUNCEMENTS}:${userId}` : null;
  try {
    const userScoped = userKey ? localStorage.getItem(userKey) : null;
    const legacy = userScoped ? null : localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS);
    const saved = JSON.parse(userScoped || legacy || 'null');
    return saved ? { ...DEFAULT_ANNOUNCEMENTS, ...saved } : { ...DEFAULT_ANNOUNCEMENTS };
  } catch {
    return { ...DEFAULT_ANNOUNCEMENTS };
  }
}

export class ChatIntegrator {
  constructor(clientManager, state, diceRoller) {
    this.clientManager = clientManager;
    this.state = state;
    this.diceRoller = diceRoller;
    this.announcements = _loadAnnouncements(clientManager?.userId);
  }

  init() {
    this._onTimelineEvent = (e) => {
      handleTimelineEvent(this, /** @type {CustomEvent} */ (e).detail).catch((err) =>
        showErrorNotification(new VTTError(ErrorType.UNKNOWN, `Chat event error: ${err.message}`, err)),
      );
    };
    window.addEventListener('matrix:timeline-event', this._onTimelineEvent);
    // NB: don't replayLiveTimeline / scrollback here - at this point in
    // boot, ui._onChat hasn't been attached yet (lifecycle-init runs
    // later). Dispatched CHAT_MESSAGE events would land in a window with
    // no listener and evaporate. `hydrateFromTimeline()` runs from
    // lifecycle-init AFTER the CHAT_MESSAGE listener is in place.
  }

  /**
   * Pull historical events into activityLog. Called by lifecycle-init
   * after `_setupChatListeners` has attached `ui._onChat`. Two phases:
   *
   *   1. Replay the events the SDK processed during initial sync
   *      (already in `room.getLiveTimeline().getEvents()`).
   *   2. Scrollback further history so scenes / chat from prior
   *      sessions reach activityLog. matrix-js-sdk's initialSyncLimit
   *      caps the live timeline at ~10 events; Element fetches more on
   *      demand. We do the same so the IconRail Scenes drawer + scene
   *      cards in the chat log hydrate.
   *
   * Both phases are idempotent via `_seenLogEventIds` dedup in log().
   */
  hydrateFromTimeline(ui) {
    const api = this.clientManager?.getApi?.();
    if (!api) {
      logger.log('ChatIntegrator', 'hydrateFromTimeline skipped - no api');
      return;
    }
    const replayed = api.replayLiveTimeline?.();
    logger.log('ChatIntegrator',
      `hydrateFromTimeline: replayLiveTimeline forwarded ${replayed ?? 'undefined'}`);
    if (ui) {
      backfillRecentHistory(ui).catch((err) => logger.warn('ChatIntegrator',
        `backfillRecentHistory failed: ${err?.message || err}`));
    } else {
      logger.log('ChatIntegrator', 'hydrateFromTimeline: no ui - scrollback skipped');
    }
  }

  destroy() {
    if (this._onTimelineEvent) {
      window.removeEventListener('matrix:timeline-event', this._onTimelineEvent);
      this._onTimelineEvent = null;
    }
  }

  handleTimelineEvent(event)          { return handleTimelineEvent(this, event); }
  parseDiceRollCommand(message)       { return parseDiceRollCommand(message); }
  parseDiceNotation(notation)         { return parseDiceNotation(notation); }
  executeDiceRollFromChat(cmd, sender){ return executeDiceRollFromChat(this, cmd, sender); }
  getCharacterNameForUser(userId)     { return getCharacterNameForUser(this, userId); }

  async _send(body) {
    try {
      await this.state.sendRoomEvent(EVENT_TYPES.ROOM_MESSAGE, { msgtype: 'm.text', body });
    } catch (err) {
      showErrorNotification(new VTTError(ErrorType.NETWORK, `Chat send failed: ${err.message}`, err));
    }
  }

  /**
   * Send a whisper - a private out-of-character message to one or
   * more users. Backed by a `com.vtt.whisper` timeline event with a
   * `to: [mxid, ...]` recipient list. The receiver-side filter in
   * timeline-intake.js shows the message only when the local user is
   * the sender or is in the `to` list. Whispers don't sync into
   * `m.room.message`, so non-VTT Matrix clients won't see them either
   * - that's the privacy guarantee.
   */
  async sendWhisper(toUserIds, body) {
    if (!Array.isArray(toUserIds) || toUserIds.length === 0) return;
    const trimmed = String(body ?? '').trim();
    if (!trimmed) return;
    try {
      await this.state.sendRoomEvent(EVENT_TYPES.WHISPER, {
        to: toUserIds,
        body: trimmed,
        ts: Date.now(),
      });
    } catch (err) {
      showErrorNotification(new VTTError(ErrorType.NETWORK, `Whisper send failed: ${err.message}`, err));
    }
  }
  postDiceRollToChat(rollData)                        { return postDiceRollToChat(this, rollData); }
  announceDamage(tokenName, damage, newHp, maxHp)     { return announceDamage(this, tokenName, damage, newHp, maxHp); }
  announceHeal(tokenName, heal, newHp, maxHp)         { return announceHeal(this, tokenName, heal, newHp, maxHp); }
  announceCombat(message)                             { return announceCombat(this, message); }
  announceMapChange(mapName)                          { return announceMapChange(this, mapName); }
  announceInitiativeOrder(order)                      { return announceInitiativeOrder(this, order); }
  announceTurn(round, name)                           { return announceTurn(this, round, name); }
  announceMessage(message, assertive = false)         { return announceMessage(this, message, assertive); }

  saveAnnouncements() {
    const userId = this.clientManager?.userId;
    if (!userId) return;
    localStorage.setItem(
      `${STORAGE_KEYS.ANNOUNCEMENTS}:${userId}`,
      JSON.stringify(this.announcements),
    );
  }

  setAnnouncementSettings(settings) {
    this.announcements = { ...this.announcements, ...settings };
    try {
      this.saveAnnouncements();
    } catch (error) {
      logger.debug('ChatIntegrator', 'localStorage quota exceeded, settings not persisted', error);
    }
  }
}
