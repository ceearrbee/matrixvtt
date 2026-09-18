/**
 * "Next turn" waits for a turn to be next.
 *
 * The phone composer already renders the button only while an order is
 * running. The desktop quick tray rendered it permanently and disabled,
 * so every table that has never rolled initiative - including every
 * brand-new one - carries a dead control in the chat column forever.
 * Two surfaces, one answer: the phone's.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, h } from 'preact';
import { QuickTray } from '../ui/QuickTray.jsx';
import { initiativeSignal } from '../state/signals.js';

function mount(host, active) {
  initiativeSignal.value = { active, round: active ? 1 : 0, current_index: 0, order: [] };
  render(h(QuickTray, { ui: /** @type {any} */ ({ rollDice: () => {}, nextTurn: () => {} }) }), host);
}

describe('QuickTray next turn', () => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  afterEach(() => {
    render(null, host);
    initiativeSignal.value = { active: false, round: 0, current_index: 0, order: [] };
  });

  it('is absent while no combat is running', () => {
    mount(host, false);
    expect(host.querySelector('[data-quick="next-turn"]')).toBeNull();
  });

  it('appears when combat starts', () => {
    mount(host, true);
    const btn = host.querySelector('[data-quick="next-turn"]');
    expect(btn).not.toBeNull();
    expect(btn.disabled).toBe(false);
  });

  it('never leaves a disabled next-turn button on screen', () => {
    mount(host, false);
    mount(host, true);
    mount(host, false);
    expect(host.querySelector('[data-quick="next-turn"]')).toBeNull();
  });

  it('keeps d20 available in both states', () => {
    mount(host, false);
    expect(host.querySelector('[data-quick="d20"]')).not.toBeNull();
    mount(host, true);
    expect(host.querySelector('[data-quick="d20"]')).not.toBeNull();
  });
});
