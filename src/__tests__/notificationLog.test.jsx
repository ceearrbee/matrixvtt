/**
 * NotificationLog - body for the `notifications` popup. Lists the
 * session's toast history newest-first, marks all read on mount (which
 * clears the ☰ badge), and offers Clear all.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { h } from 'preact';
import {
  notificationHistorySignal, lastSeenTsSignal, addNotification, unreadCount,
} from '../state/notification-history.js';
import { NotificationLog } from '../ui/NotificationLog.jsx';

beforeEach(() => {
  notificationHistorySignal.value = [];
  lastSeenTsSignal.value = 0;
});

describe('NotificationLog', () => {
  it('lists entries newest-first with their message text', () => {
    addNotification({ level: 'info', message: 'alpha', ts: 1 });
    addNotification({ level: 'error', message: 'beta', ts: 2 });
    render(h(NotificationLog, {}));
    const rows = screen.getAllByRole('listitem');
    expect(rows[0].textContent).toContain('beta');
    expect(rows[1].textContent).toContain('alpha');
  });

  it('marks all read on mount so unread drops to zero', () => {
    addNotification({ level: 'info', message: 'x', ts: 10 });
    render(h(NotificationLog, {}));
    expect(unreadCount(notificationHistorySignal.value, lastSeenTsSignal.value)).toBe(0);
  });

  it('Clear all empties the history', () => {
    addNotification({ level: 'info', message: 'x', ts: 1 });
    render(h(NotificationLog, {}));
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    expect(notificationHistorySignal.value).toEqual([]);
  });

  it('shows an empty state when there are no notifications', () => {
    const { container } = render(h(NotificationLog, {}));
    expect(container.textContent).toMatch(/no notifications/i);
  });
});
