/**
 * DiscoveryScreen.jsx - Standalone discovery screen.
 *
 * Renders into the main pane of `StandaloneShell`. The shell's sidebar
 * owns the brand, Docs link, Sign Out, and Factory Reset - this screen
 * is just the section list.
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { confirmAndEnterRoom } from './discovery/room-preview.js';
import { clearRecentSessionsForUser } from './sessionStore.js';
import { parseRoomTarget } from './room-target.js';
import { getGameSystemPresets, describeRulesetContent, DEFAULT_RULESET_SLUG } from '../state/rulesets.js';

const PRESETS = getGameSystemPresets();

export function DiscoveryScreen({ app }) {
  const [newRoomInput, setNewRoomInput] = useState('');
  const [createRoomInput, setCreateRoomInput] = useState('');
  const [system, setSystem] = useState(DEFAULT_RULESET_SLUG);
  const [knockable, setKnockable] = useState(true);

  const onNewSession = async () => {
    if (!newRoomInput.trim()) return;
    const parsed = parseRoomTarget(newRoomInput);
    // Explicit === false: tsc only narrows the union through the
    // discriminant with an equality check while strictNullChecks is off.
    if (parsed.ok === false) {
      app.setError('discovery-error', parsed.error);
      return;
    }
    app.setError('discovery-error', '');
    await confirmAndEnterRoom(app, parsed.target, parsed.target, false, parsed.via);
  };

  const onCreateRoom = () => {
    app.handleCreateRoom?.();
  };

  const onClearRecent = async () => {
    if (app.auth?.userId) {
      clearRecentSessionsForUser(app.auth.userId);
      await app.loadDiscovery();
    }
  };

  return h('div', { class: 'discovery-card' }, [
    h('div', { class: 'discovery-account' }, [
      h('div', { id: 'discovery-name', class: 'discovery-name' }),
      h('div', { id: 'discovery-userid', class: 'discovery-userid' }),
    ]),

    h('div', {
      class: 'section-heading', id: 'recent-heading',
      style: 'display: flex; align-items: center; justify-content: space-between;',
    }, [
      h('span', null, 'Recent campaigns'),
      h('button', {
        class: 'standalone-link-btn', id: 'clear-recent-btn',
        title: 'Clear all recent campaigns from this browser',
        onClick: onClearRecent
      }, 'Clear All')
    ]),
    h('div', { id: 'recent-list' }),
    h('p', { id: 'recent-empty', class: 'room-empty', style: 'display:none' },
      'No recent campaigns yet. Open an invite link, or create one below.'),

    h('div', { class: 'section-heading' }, 'Active campaigns'),
    h('div', { id: 'active-loading', class: 'discovery-loading', style: 'display:flex;align-items:center;gap:var(--space-md);' }, [
      h('span', null, 'Loading rooms…'),
      h('button', {
        class: 'standalone-link-btn', id: 'cancel-scan-btn',
        'aria-label': 'Cancel room scan',
        // The chunked scan loop checks this flag between chunks and
        // renders whatever it fetched so far.
        onClick: () => { app.scanCancelled = true; },
      }, 'Cancel')
    ]),
    h('div', { id: 'active-list' }),
    h('p', { id: 'active-empty', class: 'room-empty', style: 'display:none' },
      'No campaigns found. Create one below, or expand all joined rooms to start a campaign in a Matrix room you already have.'),

    h('button', {
      id: 'other-rooms-toggle',
      type: 'button',
      class: 'standalone-link-btn',
      style: 'display:none; margin-top:var(--space-md);',
      title: 'Show every Matrix room your account is joined to. Click any room to start a campaign there.',
    }),
    h('div', { id: 'other-list', style: 'display:none; margin-top:var(--space-md);' }),

    h('div', { class: 'section-heading', id: 'invites-heading', style: 'display:none' }, 'Pending Invites'),
    h('div', { id: 'invites-list' }),

    h('div', { class: 'section-heading' }, 'New campaign'),
    h('p', { class: 'room-empty', style: 'margin-top: 0;' },
      'Creating a campaign makes you its GM. Players get in by opening the invite link you share.'),
    h('div', { class: 'new-session-form' }, [
      h('label', { for: 'new-session-input', class: 'sr-only' }, 'Invite link, room ID, or alias'),
      h('input', {
        id: 'new-session-input', class: 'form-input', type: 'text',
        placeholder: 'Paste an invite link, room ID, or alias',
        autocomplete: 'off', value: newRoomInput,
        onInput: (e) => setNewRoomInput(e.target.value),
        onKeyDown: (e) => { if (e.key === 'Enter') onNewSession(); }
      }),
      h('button', { class: 'dbt btn-primary', id: 'new-session-btn', onClick: onNewSession }, 'Join')
    ]),
    h('div', { class: 'new-session-divider' }, '- or -'),
    h('div', { class: 'create-room-form' }, [
      h('label', { for: 'create-room-input', class: 'sr-only' }, 'Campaign name'),
      h('input', {
        id: 'create-room-input', class: 'form-input', type: 'text',
        placeholder: 'My Epic Campaign', autocomplete: 'off',
        value: createRoomInput,
        onInput: (e) => setCreateRoomInput(e.target.value),
        onKeyDown: (e) => { if (e.key === 'Enter') onCreateRoom(); }
      }),
      h('button', { class: 'dbt btn-secondary', id: 'create-room-btn', onClick: onCreateRoom }, 'Create campaign')
    ]),
    h('div', { class: 'create-room-system-row' }, [
      h('label', { for: 'create-room-system', class: 'form-label' }, 'Game system'),
      h('select', {
        id: 'create-room-system', class: 'form-select',
        value: system,
        onChange: (e) => setSystem(e.target.value),
      }, Object.entries(PRESETS).map(([slug, preset]) =>
        h('option', { key: slug, value: slug }, preset.meta?.name ?? slug))),
      h('p', { id: 'create-room-system-note', class: 'room-empty' },
        describeRulesetContent(system, PRESETS[system])),
    ]),
    h('label', { class: 'form-check-row create-room-knock-row' }, [
      h('input', { type: 'checkbox', id: 'create-room-knock', checked: knockable, onChange: (e) => setKnockable(e.target.checked) }),
      h('span', null, 'Let players with the invite link request to join (you approve each one)'),
    ]),

    h('div', { id: 'discovery-error', class: 'auth-error', role: 'alert' }),

    h('div', { id: 'inspector-host' }),
  ]);
}
