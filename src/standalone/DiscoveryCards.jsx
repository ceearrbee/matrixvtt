
import { h, render } from 'preact';
import { relativeDate } from './app-log.js';

function InviteCard({ invite, onAccept, onDecline }) {
  return h('div', { class: 'room-card' }, [
    h('div', { class: 'room-card-info' }, [
      h('div', { class: 'room-name' }, invite.name),
      h('div', { class: 'room-meta' }, [
        'Invited',
        invite.inviter ? ` by ${invite.inviter}` : null,
        ' · ',
        h('strong', null, 'Action required'),
      ]),
    ]),
    h('div', { style: 'display: flex; gap: 6px;' }, [
      h('button', { class: 'dbt btn-primary invite-accept', onClick: onAccept }, 'Accept'),
      h('button', {
        class: 'dbt invite-decline',
        title: 'Decline invite',
        'aria-label': 'Decline invite',
        onClick: onDecline,
      }, h('span', { 'aria-hidden': 'true' }, '✖')),
    ]),
  ]);
}

function RecentSessionCard({ session, onResume, onRemove }) {
  return h('div', { class: 'session-card', 'data-room-id': session.roomId }, [
    h('div', { class: 'session-card-info' }, [
      h('div', { class: 'session-name' }, session.roomName || session.roomId),
      h('div', { class: 'session-meta' },
        `${session.displayName || session.userId} · ${relativeDate(session.lastUsed)}`),
    ]),
    h('div', { class: 'session-card-actions' }, [
      h('button', {
        type: 'button',
        class: 'dbt btn-primary recent-resume',
        onClick: (e) => { e.preventDefault(); e.stopPropagation(); onResume(); },
      }, 'Resume'),
      h('button', {
        type: 'button',
        class: 'dbt session-remove',
        title: 'Remove from this browser',
        'aria-label': 'Remove from this browser',
        onClick: (e) => { e.preventDefault(); e.stopPropagation(); onRemove(); },
      }, h('span', { 'aria-hidden': 'true' }, '🗑')),
    ]),
  ]);
}

function ActiveSessionCard({ room, onJoin, onLeave }) {
  const system = room.vttState?.system || 'generic';
  const campaignName = room.vttState?.name || room.name;
  return h('div', { class: 'room-card' }, [
    h('div', { class: 'room-card-info' }, [
      h('div', { class: 'room-name' }, campaignName),
      h('div', { class: 'room-meta' }, `${room.name} · ${system}`),
    ]),
    h('div', { style: 'display: flex; gap: 6px;' }, [
      h('button', {
        type: 'button',
        class: 'dbt btn-primary room-join',
        onClick: (e) => { e.preventDefault(); e.stopPropagation(); onJoin(); },
      }, 'Join'),
      h('button', {
        type: 'button',
        class: 'dbt room-leave',
        title: 'Leave this Matrix room',
        'aria-label': 'Leave room',
        onClick: (e) => { e.preventDefault(); e.stopPropagation(); onLeave(); },
      }, h('span', { 'aria-hidden': 'true' }, '👢')),
    ]),
  ]);
}

export function renderInviteList(container, invites, handlers) {
  render(
    h('div', null, invites.map((inv) => h(InviteCard, {
      key: inv.roomId,
      invite: inv,
      onAccept: () => handlers.accept(inv),
      onDecline: () => handlers.decline(inv),
    }))),
    container,
  );
}

export function renderRecentList(container, sessions, handlers) {
  render(
    h('div', null, sessions.map((s) => h(RecentSessionCard, {
      key: `${s.userId}::${s.roomId}`,
      session: s,
      onResume: () => handlers.resume(s),
      onRemove: () => handlers.remove(s),
    }))),
    container,
  );
}

export function renderActiveList(container, rooms, handlers) {
  render(
    h('div', null, rooms.map((r) => h(ActiveSessionCard, {
      key: r.id,
      room: r,
      onJoin: () => handlers.join(r),
      onLeave: () => handlers.leave(r),
    }))),
    container,
  );
}
