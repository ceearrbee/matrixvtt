/**
 * RoomReadableNotice.jsx - says, once per room, that nothing MatrixVTT
 * stores here is private from the room's members, and that a public
 * room adds anyone who joins. Stays until the user acknowledges it.
 */

import { h } from 'preact';
import { roomAccessSignal } from '../state/signals.js';
import { useStorageSubscription } from './hooks/use-storage.js';
import { STORAGE_KEYS } from '../utils/constants.js';
import {
  isPublicJoinRule, READABLE_ROOM_NOTICE, PUBLIC_ROOM_NOTICE,
} from '../utils/room-access.js';

export function RoomReadableNotice({ ui }) {
  const roomId = ui.widgetManager?.roomId ?? '';
  const [seen, setSeen] = useStorageSubscription(
    `${STORAGE_KEYS.READABLE_NOTICE_SEEN}:${roomId}`,
    { userId: ui.widgetManager?.userId ?? null },
  );
  if (seen === '1') return null;

  const isPublic = isPublicJoinRule(roomAccessSignal.value.joinRule);
  return h('section', { class: 'room-notice', 'aria-label': 'Who can read this room' }, [
    h('p', { class: 'room-notice__text' }, [
      isPublic && h('strong', null, `${PUBLIC_ROOM_NOTICE} `),
      READABLE_ROOM_NOTICE,
    ]),
    h('button', {
      type: 'button',
      class: 'dbt dbt--sm',
      onClick: () => setSeen('1'),
    }, 'Got it'),
  ]);
}
