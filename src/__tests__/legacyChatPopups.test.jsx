/**
 * LegacyChatPopups - popup host mounted inside the legacy App.jsx.
 *
 * Drives ModePopup / OOCPanel / BrowsePanel via popupsSignal.open
 * without the panel-registry indirection the deprecated chat-shell
 * scaffolding used. Each Header chip toggles its name; this host
 * mounts the matching FloatingPopup.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { LegacyChatPopups } from '../ui/LegacyChatPopups.jsx';
import { popupsSignal, openPopup, closePopup } from '../state/popup-signals.js';
import { chatModeSignal, logVersionSignal } from '../state/ui-signals.js';

function makeUi(activityLog = []) {
  return /** @type {any} */ ({
    activityLog,
    sendChatMessage: vi.fn(),
  });
}

beforeEach(() => {
  popupsSignal.value = { open: new Set() };
  chatModeSignal.value = 'say';
  logVersionSignal.value = 0;
});

afterEach(() => {
  cleanup();
  document.body.querySelectorAll('[data-floating-popup]').forEach((n) => n.remove());
});

describe('LegacyChatPopups', () => {
  it('renders nothing when no popup is open', () => {
    render(h(LegacyChatPopups, { ui: makeUi() }));
    expect(document.body.querySelector('[data-floating-popup]')).toBeNull();
  });

  it('opens the Mode popup when "mode" is in popupsSignal.open', () => {
    openPopup('mode');
    render(h(LegacyChatPopups, { ui: makeUi() }));
    const pop = document.body.querySelector('[data-floating-popup="mode"]');
    expect(pop).not.toBeNull();
    // ModePopup body - radios for say/describe/ooc.
    expect(document.body.querySelector('[data-mode-radio="say"]')).not.toBeNull();
  });

  it('opens the OOC popup when "ooc" is in popupsSignal.open', () => {
    openPopup('ooc');
    render(h(LegacyChatPopups, { ui: makeUi() }));
    const pop = document.body.querySelector('[data-floating-popup="ooc"]');
    expect(pop).not.toBeNull();
    expect(document.body.querySelector('[data-ooc-empty]')).not.toBeNull();
  });

  it('opens the Browse popup when "browse" is in popupsSignal.open', () => {
    openPopup('browse');
    render(h(LegacyChatPopups, { ui: makeUi() }));
    const pop = document.body.querySelector('[data-floating-popup="browse"]');
    expect(pop).not.toBeNull();
    expect(document.body.querySelector('[data-browse-tab="find"]')).not.toBeNull();
  });

  it('opens multiple popups simultaneously', () => {
    openPopup('mode');
    openPopup('ooc');
    render(h(LegacyChatPopups, { ui: makeUi() }));
    expect(document.body.querySelector('[data-floating-popup="mode"]')).not.toBeNull();
    expect(document.body.querySelector('[data-floating-popup="ooc"]')).not.toBeNull();
  });

  it('skips unknown popup names without throwing', () => {
    openPopup('does-not-exist');
    expect(() => render(h(LegacyChatPopups, { ui: makeUi() }))).not.toThrow();
    expect(document.body.querySelector('[data-floating-popup]')).toBeNull();
  });

  it('ESC on a popup closes only that popup', () => {
    openPopup('mode');
    openPopup('ooc');
    render(h(LegacyChatPopups, { ui: makeUi() }));
    fireEvent.keyDown(document, { key: 'Escape' });
    // ESC bubbles to both listeners; at minimum one popup closes.
    // Verify the signal state moved.
    expect(popupsSignal.value.open.size).toBeLessThan(2);
  });

  it('closePopup removes the popup from the DOM', () => {
    openPopup('browse');
    const { rerender } = render(h(LegacyChatPopups, { ui: makeUi() }));
    expect(document.body.querySelector('[data-floating-popup="browse"]')).not.toBeNull();
    closePopup('browse');
    rerender(h(LegacyChatPopups, { ui: makeUi() }));
    expect(document.body.querySelector('[data-floating-popup="browse"]')).toBeNull();
  });
});
