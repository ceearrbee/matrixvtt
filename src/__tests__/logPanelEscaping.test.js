/**
 * Lock-in tests for the LogPanel escape contract (LogPanel.jsx
 * TrustedMarkup). If a producer site ever reaches `ui._log` without
 * escaping a user-authored field, these tests must fail.
 *
 * Also verifies that log entries carry eventId + sender when opts are provided.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { log } from '../ui/log-panel.js';
import { createNPCFromTemplate } from '../ui/entity-manager.js';

function makeUI() {
  const entries = [];
  return {
    _log: (icon, html) => entries.push({ icon, html }),
    _entries: entries,
    state: { npcs: new Map() },
    widgetManager: {
      sendStateEvent: vi.fn(async () => 'evt-1'),
    },
  };
}

describe('log() entry shape', () => {
  it('includes eventId and sender from opts', () => {
    const activityLog = [];
    const ui = {
      activityLog,
      switchTab: vi.fn(),
    };
    // bumpLogVersion needs to be available; patch it
    log(ui, '💬', 'hello', { eventId: '$x1', sender: '@s:m' });
    expect(activityLog[0].eventId).toBe('$x1');
    expect(activityLog[0].sender).toBe('@s:m');
  });

  it('defaults eventId and sender to null when opts omitted', () => {
    const activityLog = [];
    const ui = { activityLog, switchTab: vi.fn() };
    log(ui, '💬', 'hello');
    expect(activityLog[0].eventId).toBeNull();
    expect(activityLog[0].sender).toBeNull();
  });
});

describe('LogPanel escape contract - producer sites', () => {
  beforeEach(() => vi.clearAllMocks());

  it('createNPCFromTemplate escapes XSS-shaped NPC names', async () => {
    const ui = makeUI();
    await createNPCFromTemplate(ui, {
      name: '<script>alert(1)</script>',
      cr: '1',
      hp_max: 10,
      ac: 12,
      speed: 30,
      attributes: {},
      actions: [],
    });
    const last = ui._entries.at(-1);
    expect(last.html).not.toContain('<script>');
    expect(last.html).toContain('&lt;script&gt;');
  });

  it('createNPCFromTemplate escapes XSS-shaped CR fields', async () => {
    const ui = makeUI();
    await createNPCFromTemplate(ui, {
      name: 'Goblin',
      cr: '"><img src=x>',
      hp_max: 10,
      ac: 12,
      speed: 30,
      attributes: {},
      actions: [],
    });
    const last = ui._entries.at(-1);
    expect(last.html).not.toContain('<img');
    expect(last.html).toContain('&lt;img');
  });
});
