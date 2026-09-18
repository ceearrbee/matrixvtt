/**
 * The browser tab title, and the only module that writes it.
 *
 * Two writers would race: whichever set the title last would erase the
 * other's marker, which is how an unread count quietly swallows a turn
 * prompt. Callers set the facts, this composes the string.
 */

let baseTitle = null;
let turnWaiting = false;
let unread = 0;

function base() {
  if (baseTitle === null) baseTitle = document.title;
  return baseTitle;
}

function paint() {
  const parts = [];
  if (unread > 0) parts.push(`(${unread})`);
  if (turnWaiting) parts.push('(Your turn)');
  parts.push(base());
  document.title = parts.join(' ');
}

export function setTurnFlag(on) {
  turnWaiting = !!on;
  paint();
}

export function setUnreadCount(count) {
  unread = Math.max(0, Math.floor(Number(count) || 0));
  paint();
}

/** Drop every marker and forget the captured base title. */
export function resetTabSignal() {
  turnWaiting = false;
  unread = 0;
  if (baseTitle !== null) document.title = baseTitle;
  baseTitle = null;
}
