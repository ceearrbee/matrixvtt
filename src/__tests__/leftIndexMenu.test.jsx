/**
 * LeftIndex footer - the four inline buttons collapsed into a single
 * ☰ Menu button that opens the consolidated globalMenu popup, with an
 * unread-notification badge.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { h } from 'preact';
import { LeftIndex } from '../ui/LeftIndex.jsx';
import { popupsSignal, isPopupOpen } from '../state/popup-signals.js';
import {
  notificationHistorySignal, lastSeenTsSignal, addNotification,
} from '../state/notification-history.js';

const ui = { state: { isGM: () => false } };

beforeEach(() => {
  popupsSignal.value = { open: new Set() };
  notificationHistorySignal.value = [];
  lastSeenTsSignal.value = 0;
});

describe('LeftIndex menu footer', () => {
  it('renders a single Menu button that opens the globalMenu popup', () => {
    render(h(LeftIndex, { ui }));
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(isPopupOpen('globalMenu')).toBe(true);
  });

  it('shows an unread badge when there are unseen notifications', () => {
    addNotification({ level: 'error', message: 'x', ts: Date.now() + 1000 });
    const { container } = render(h(LeftIndex, { ui }));
    expect(container.querySelector('.menu-badge')?.textContent).toBe('1');
  });
});
