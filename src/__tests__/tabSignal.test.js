/**
 * The browser tab is the only surface a player sees when the app is
 * not the front window, so the title carries what they need to come
 * back for: whose turn it is, and how much they have missed.
 *
 * One module owns `document.title`. Two modules composing a title
 * means whichever wrote last wins, which is how a turn marker gets
 * silently erased by an unread count.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { setTurnFlag, setUnreadCount, resetTabSignal } from '../ui/notify/tab-signal.js';

const BASE = 'MatrixVTT';

beforeEach(() => {
  document.title = BASE;
  resetTabSignal();
  document.title = BASE;
});
afterEach(() => resetTabSignal());

describe('tab title signal', () => {
  it('leaves the title alone when nothing is waiting', () => {
    expect(document.title).toBe(BASE);
  });

  it('marks the tab when the turn is mine', () => {
    setTurnFlag(true);
    expect(document.title).toBe(`(Your turn) ${BASE}`);
  });

  it('counts unread messages', () => {
    setUnreadCount(3);
    expect(document.title).toBe(`(3) ${BASE}`);
  });

  it('shows both without either erasing the other', () => {
    setUnreadCount(2);
    setTurnFlag(true);
    expect(document.title).toBe(`(2) (Your turn) ${BASE}`);
  });

  it('restores the base title when the turn passes', () => {
    setTurnFlag(true);
    setTurnFlag(false);
    expect(document.title).toBe(BASE);
  });

  it('drops the count at zero', () => {
    setUnreadCount(4);
    setUnreadCount(0);
    expect(document.title).toBe(BASE);
  });

  it('never compounds its own prefix', () => {
    setTurnFlag(true);
    setTurnFlag(true);
    setUnreadCount(1);
    setUnreadCount(2);
    expect(document.title).toBe(`(2) (Your turn) ${BASE}`);
  });
});

describe('one writer owns the title', () => {
  function sourceFiles(dir, out = []) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name === '__tests__') continue;
        sourceFiles(full, out);
      } else if (/\.jsx?$/.test(name)) out.push(full);
    }
    return out;
  }

  it('no module but tab-signal.js assigns document.title', () => {
    const src = join(process.cwd(), 'src');
    const owner = join(src, 'ui/notify/tab-signal.js');
    const writers = sourceFiles(src)
      .filter((f) => f !== owner)
      .filter((f) => /document\.title\s*=/.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(src.length + 1));
    expect(writers, 'route title changes through ui/notify/tab-signal.js').toEqual([]);
  });
});
