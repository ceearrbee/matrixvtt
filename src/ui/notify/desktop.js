/**
 * The browser-facing half of the turn signal: the permission prompt,
 * the system notification and the chime.
 *
 * Kept apart from `my-turn.js` so the decision stays testable without
 * a browser, and so every call into these APIs has one home.
 *
 * The chime is synthesized rather than loaded: an audio file would be
 * a bundled asset, and a Matrix-hosted one would need a round trip at
 * the exact moment the player is waiting.
 */

import { logger } from '../../utils/logger.js';

export function notificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export function notificationsAvailable() {
  return notificationPermission() !== 'unsupported';
}

/** Only ever called from the opt-in control, never on load. */
export async function requestNotificationPermission() {
  if (!notificationsAvailable()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch (e) {
    logger.warn('UI', 'Notification permission request failed:', e.message);
    return notificationPermission();
  }
}

export function showTurnNotification(name) {
  if (notificationPermission() !== 'granted') return null;
  try {
    return new Notification('Your turn', {
      body: name ? `${name} is up.` : 'The table is waiting on you.',
      // One tag, so a turn notice replaces the last one rather than
      // stacking a row of them down the corner of the screen.
      tag: 'vtt-your-turn',
    });
  } catch (e) {
    logger.warn('UI', 'Turn notification failed:', e.message);
    return null;
  }
}

export function playTurnChime() {
  const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctx) return false;
  try {
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    // Short, and fading rather than cut, so it reads as a chime and
    // not as a click.
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
    osc.onended = () => ctx.close?.();
    return true;
  } catch (e) {
    logger.warn('UI', 'Turn chime failed:', e.message);
    return false;
  }
}
