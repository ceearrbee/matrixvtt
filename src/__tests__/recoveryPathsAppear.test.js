/**
 * The two recovery surfaces have to actually appear.
 *
 * Both were written, wired and unreachable. The sync-dead banner is
 * appended into `#app`, an element that exists only in the widget
 * entry: in the standalone app the lookup returns null, the guard
 * returns early, and a player whose sync loop died is told nothing.
 * The banner also has no stylesheet rule of its own.
 *
 * The error boundary wraps only the login and discovery router, so a
 * render throw inside a live session blanks the shell with no card
 * and no way back.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { h } from 'preact';
import { screen, act } from '@testing-library/preact';
import { showSyncDeadBanner } from '../ui/sync/sync-banner.js';
import { mountApp } from '../ui/App.jsx';

const read = (rel) => readFileSync(join(process.cwd(), rel), 'utf8');

beforeEach(() => {
  document.body.innerHTML = '';
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('the sync-dead banner reaches both entries', () => {
  it('is not appended into an id that only one entry has', () => {
    const appClient = read('src/app-client.js');
    expect(appClient, 'app.html has no #app, so this lookup always returns null')
      .not.toMatch(/getElementById\('app'\)/);
  });

  it('carries a stylesheet rule so it is not an unstyled div', () => {
    expect(read('src/styles.css')).toContain('.sync-dead-banner');
  });

  it('styles its button through a class, not an inline style', () => {
    expect(read('src/ui/sync/sync-banner.js')).not.toMatch(/data-reconnect-btn[^>]*style=/);
  });

  it('still renders once into whatever container it is given', () => {
    showSyncDeadBanner(document.body, () => {});
    showSyncDeadBanner(document.body, () => {});
    expect(document.querySelectorAll('[data-sync-dead-banner]')).toHaveLength(1);
  });
});

describe('a render throw inside a session shows the recovery card', () => {
  function makeUi() {
    return /** @type {any} */ ({
      state: {
        // A throwing isGM is the cheapest way to make the tree throw
        // during render rather than during setup.
        isGM: () => { throw new Error('kaboom'); },
        tokens: new Map(), maps: new Map(), characters: new Map(), npcs: new Map(),
        items: new Map(), spells: new Map(), handouts: new Map(), tables: new Map(),
        pages: new Map(), pins: new Map(), walls: new Map(), lights: new Map(),
        templates: new Map(), drawings: [], roomMembers: [],
        settings: { name: 'r', systemConfig: {}, gm_user_ids: [] },
        initiative: { active: false, round: 0, current_index: 0, order: [] },
        fog: { mode: null, revealed: [] },
        activeMapId: null, powerLevels: null, damageLog: [], pendingKnocks: [],
        getCurrentCharacter: () => null,
        isTokenVisibleToPlayer: () => true,
      },
      widgetManager: { userId: '@me:m', roomId: '!r:m', canLeave: true, isAppClient: true },
      _isMyCombatTurn: () => false,
      _currentTab: 'sheet',
      chat: { announcements: {} },
      _latestDiceResult: '',
    });
  }

  // The boundary catches during render and then setStates, which Preact
  // flushes on its own schedule, so the assertions run inside act().
  function mountThrowing() {
    const host = document.createElement('div');
    document.body.appendChild(host);
    act(() => { mountApp(host, makeUi()); });
    return host;
  }

  it('does not leave the shell blank', () => {
    expect(mountThrowing().innerHTML, 'a throwing session tree rendered nothing at all').not.toBe('');
  });

  it('offers a way out', () => {
    mountThrowing();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
  });
});
