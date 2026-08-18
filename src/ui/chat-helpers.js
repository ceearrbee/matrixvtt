/**
 * chat-helpers.js - Utilities for the chat send flow.
 */

/**
 * Parse a "/roll <formula> [text]" command.
 * @param {string} body - Raw chat input text
 * @returns {{ formula: string, text: string } | null}
 */
export function parseRollCommand(body) {
  // eslint-disable-next-line security/detect-unsafe-regex -- anchored chat-command parse; `[\s\S]+` runs once over already-trimmed chat body
  const match = body.match(/^\/roll\s+(\S+)(?:\s+([\s\S]+))?$/i);
  if (!match) return null;
  return {
    formula: match[1],
    text: (match[2] ?? '').trim(),
  };
}

/**
 * Parse a "/w @userId <message>" or "/whisper @userId <message>" command.
 * @param {string} body
 * @returns {{ to: string, text: string } | null}
 */
export function parseWhisperCommand(body) {
  const match = body.match(/^\/(?:w|whisper)\s+(\S+)\s+([\s\S]+)$/i);
  if (!match) return null;
  return { to: match[1], text: match[2].trim() };
}

/**
 * Determine whether a chat message should be visible to the given viewer.
 * Non-whisper messages are always visible.
 * @param {{ sender?: string, whisper_to?: string }} msg
 * @param {string} myUserId
 */
export function isWhisperVisible(msg, myUserId) {
  if (!msg.whisper_to) return true;
  return msg.sender === myUserId || msg.whisper_to === myUserId;
}
