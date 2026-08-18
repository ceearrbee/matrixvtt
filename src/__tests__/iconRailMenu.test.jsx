/**
 * IconRail ☰ drawer - hosts the consolidated GlobalMenu (plus the
 * activity log) and shows the unread-notification badge on the button.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { h } from 'preact';
import { IconRail } from '../ui/IconRail.jsx';
import { openIconRailDrawerSignal } from '../state/ui-signals.js';
import {
  notificationHistorySignal, lastSeenTsSignal, addNotification,
} from '../state/notification-history.js';

const ui = {
  state: { isGM: () => false },
  widgetManager: { userId: 'u', roomId: 'r', canLeave: false },
  activityLog: [],
};

beforeEach(() => {
  openIconRailDrawerSignal.value = null;
  notificationHistorySignal.value = [];
  lastSeenTsSignal.value = 0;
});

describe('IconRail menu drawer', () => {
  it('opening the Menu drawer renders the GlobalMenu items', () => {
    const { container } = render(h(IconRail, { ui }));
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(container.querySelector('[data-menu-item="settings"]')).not.toBeNull();
  });

  it('shows an unread badge on the Menu button', () => {
    addNotification({ level: 'info', message: 'x', ts: Date.now() + 1000 });
    const { container } = render(h(IconRail, { ui }));
    expect(container.querySelector('.menu-badge')?.textContent).toBe('1');
  });
});
