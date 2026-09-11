/**
 * Name and system are collected once, where the room is created. The
 * GM used to name the session here and then name the campaign again,
 * and pick a system, inside the setup wizard.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { h } from 'preact';
import { DiscoveryScreen } from '../standalone/DiscoveryScreen.jsx';

function makeApp() {
  return /** @type {any} */ ({
    auth: { userId: '@gm:hs' },
    setError: () => {},
    loadDiscovery: async () => {},
    handleCreateRoom: () => {},
  });
}

describe('create-room system picker', () => {
  afterEach(cleanup);

  it('offers a game system alongside the session name', () => {
    const { container } = render(h(DiscoveryScreen, { app: makeApp() }));
    const select = container.querySelector('#create-room-system');
    expect(select).not.toBeNull();
    expect(select.querySelectorAll('option').length).toBeGreaterThan(4);
    expect(container.querySelector('label[for="create-room-system"]')).not.toBeNull();
  });

  it('states what the selected system ships, and updates when it changes', () => {
    const { container } = render(h(DiscoveryScreen, { app: makeApp() }));
    const note = container.querySelector('#create-room-system-note');
    expect(note.textContent).toMatch(/compendium/i);
    fireEvent.change(container.querySelector('#create-room-system'), { target: { value: 'gurps' } });
    expect(container.querySelector('#create-room-system-note').textContent).toMatch(/bring your own/i);
  });
});
