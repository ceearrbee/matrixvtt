/**
 * KnockRequests - GM-only list of pending knocks (m.room.member with
 * membership 'knock'), rendered at the top of the party roster.
 * Approve invites the knocker into the room; Deny kicks the knock
 * away. Both actions retry through the rate-limit helper.
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { pendingKnocksSignal } from '../state/signals.js';
import { retryOnRateLimit } from '../utils/matrixRetry.js';
import { describeNetworkError } from '../utils/errorHandling.js';

export function KnockRequests({ ui }) {
  const knocks = pendingKnocksSignal.value;
  const [busyId, setBusyId] = useState(null);
  if (!ui?.state?.isGM?.() || knocks.length === 0) return null;

  const act = async (userId, approve) => {
    setBusyId(userId);
    try {
      if (approve) {
        await retryOnRateLimit(() => ui.widgetManager.inviteUser(userId));
      } else {
        await retryOnRateLimit(() => ui.widgetManager.kickUser(userId, 'Join request declined by the GM'));
      }
      ui.state.pendingKnocks = knocks.filter((k) => k.userId !== userId);
      ui._toast?.(approve ? `Invited ${userId}.` : `Declined ${userId}.`, 'success');
    } catch (err) {
      ui._toast?.(
        `Could not ${approve ? 'approve' : 'decline'} ${userId}. ${describeNetworkError(err)}`,
        'error',
      );
    } finally {
      setBusyId(null);
    }
  };

  return h('section', {
    class: 'party-roster__section knock-requests',
    'aria-label': 'Join requests',
  }, [
    h('div', { class: 'party-roster__label' }, 'Join requests'),
    h('ul', { class: 'knock-requests__list' }, knocks.map((k) => h('li', {
      key: k.userId,
      class: 'knock-requests__row',
      'data-knock-user': k.userId,
    }, [
      h('div', { class: 'knock-requests__who' }, [
        h('span', { class: 'knock-requests__name' }, k.displayname || k.userId),
        k.displayname && k.displayname !== k.userId
          && h('span', { class: 'knock-requests__id' }, k.userId),
        k.reason && h('span', { class: 'knock-requests__reason' }, k.reason),
      ]),
      h('div', { class: 'row-xs' }, [
        h('button', {
          type: 'button', class: 'dbt dbt--sm btn-primary',
          disabled: busyId === k.userId,
          onClick: () => act(k.userId, true),
        }, 'Approve'),
        h('button', {
          type: 'button', class: 'dbt dbt--sm',
          disabled: busyId === k.userId,
          onClick: () => act(k.userId, false),
        }, 'Deny'),
      ]),
    ]))),
  ]);
}
