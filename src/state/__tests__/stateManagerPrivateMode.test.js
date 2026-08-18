/**
 * Private-browsing mode throws SecurityError on every localStorage call.
 * StateManager construction must not abort the app when localStorage is
 * unavailable.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StateManager } from '../StateManager.js';
import { createMockWidgetManager } from '../../../tests/mocks/widgetManager.mock.js';

vi.mock('../../widget/SubscriptionManager.js', () => ({
  SubscriptionManager: class {
    subscribe() {} unsubscribeAll() {} destroy() {}
  }
}));

describe('private-mode localStorage safety', () => {
  let originalGet;
  let originalSet;

  beforeEach(() => {
    originalGet = Storage.prototype.getItem;
    originalSet = Storage.prototype.setItem;
    Storage.prototype.getItem = () => { throw new DOMException('private mode', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('private mode', 'SecurityError'); };
  });

  afterEach(() => {
    Storage.prototype.getItem = originalGet;
    Storage.prototype.setItem = originalSet;
  });

  it('StateManager constructor does not throw when localStorage is unavailable', () => {
    const wm = createMockWidgetManager({ isStandalone: true });
    expect(() => new StateManager(wm)).not.toThrow();
  });
});
