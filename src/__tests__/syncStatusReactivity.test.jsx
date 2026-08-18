/**
 * Same shape as the View Full Sheet bug, two more surfaces:
 *
 *   - `_syncOk` was a plain property; Header.jsx read it without
 *     subscribing to anything. The imperative updateSyncBadge() patched
 *     the DOM directly to compensate.
 *   - `_queueCount` was a plain property; ApiStatus.jsx read it and
 *     relied on a 1Hz tick interval to re-render.
 *
 * Both now route through ui-signals so Preact's auto-subscribe wakes
 * the components when the values change.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, h } from 'preact';
import { syncOkSignal, queueCountSignal } from '../state/ui-signals.js';
import { Header } from '../ui/Header.jsx';
import { ApiStatus } from '../ui/sync/ApiStatus.jsx';

async function flush() { await Promise.resolve(); await Promise.resolve(); }

function mount(vnode) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  render(vnode, root);
  return root;
}

beforeEach(() => {
  syncOkSignal.value = false;
  queueCountSignal.value = 0;
  document.body.innerHTML = '';
});

describe('Header reacts to syncOkSignal', () => {
  function makeUi() {
    return {
      state: {
        isGM: () => false,
        settings: { name: 'Test Room' },
        initiative: { active: false, round: 0, current_index: 0, order: [] },
        roomMembers: [],
      },
      widgetManager: {},
      openSettings: vi.fn(),
      openMapsPanel: vi.fn(),
    };
  }

  it('renders "Reconnecting" when syncOkSignal is false', () => {
    const ui = makeUi();
    const root = mount(h(Header, { ui }));
    const btn = root.querySelector('[data-sync-status]');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toMatch(/Reconnecting/);
  });

  it('flips to "Live" when syncOkSignal flips to true', async () => {
    const ui = makeUi();
    const root = mount(h(Header, { ui }));
    syncOkSignal.value = true;
    await flush();
    const btn = root.querySelector('[data-sync-status]');
    expect(btn.textContent).toMatch(/Live/);
    expect(btn.className).toMatch(/dbt--active/);
  });

  it('flips back to "Reconnecting" when the signal drops', async () => {
    const ui = makeUi();
    syncOkSignal.value = true;
    const root = mount(h(Header, { ui }));
    expect(root.querySelector('[data-sync-status]').textContent).toMatch(/Live/);
    syncOkSignal.value = false;
    await flush();
    expect(root.querySelector('[data-sync-status]').textContent).toMatch(/Reconnecting/);
  });
});

describe('ApiStatus reacts to queueCountSignal', () => {
  function makeUi() {
    return {
      _rateLimitSeconds: 0,
      widgetManager: { userId: '@me' },
    };
  }

  it('shows "0 pending" / no badge when queueCount is 0', () => {
    queueCountSignal.value = 0;
    const ui = makeUi();
    const root = mount(h(ApiStatus, { ui }));
    expect(root.textContent).not.toMatch(/\d+ pending/);
  });

  it('renders the pending count when queueCountSignal is non-zero', async () => {
    queueCountSignal.value = 0;
    const ui = makeUi();
    const root = mount(h(ApiStatus, { ui }));
    queueCountSignal.value = 5;
    await flush();
    expect(root.textContent).toMatch(/5 pending/);
  });

  it('updates the count when the signal changes', async () => {
    queueCountSignal.value = 2;
    const ui = makeUi();
    const root = mount(h(ApiStatus, { ui }));
    expect(root.textContent).toMatch(/2 pending/);
    queueCountSignal.value = 7;
    await flush();
    expect(root.textContent).toMatch(/7 pending/);
    expect(root.textContent).not.toMatch(/2 pending/);
  });
});
