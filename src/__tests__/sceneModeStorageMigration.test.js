/**
 * Locks the sessionStorage → localStorage migration for the active-scene
 * pointer. The migration must be one-shot (read the legacy sessionStorage
 * slot once, then remove it) and `persistActiveScene` must not mirror to
 * sessionStorage going forward.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadActiveScene, persistActiveScene, clearActiveScene,
} from '../ui/scene-mode.js';
import { activeSceneSignal } from '../state/ui-signals.js';

const ROOM = '!room:example.org';
const KEY  = `vtt:active-scene:${ROOM}`;

describe('scene-mode storage migration', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    activeSceneSignal.value = null;
  });

  it('loadActiveScene migrates a legacy sessionStorage pointer and removes it', () => {
    const legacy = { eventId: '$legacy', title: 'Pre-migration scene' };
    sessionStorage.setItem(KEY, JSON.stringify(legacy));

    const loaded = loadActiveScene(ROOM);

    expect(loaded).toEqual(legacy);
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('persistActiveScene writes only to localStorage', () => {
    persistActiveScene(ROOM, { eventId: '$ev1', title: 'A scene' });

    expect(localStorage.getItem(KEY)).not.toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('clearActiveScene removes the localStorage entry and leaves sessionStorage untouched', () => {
    persistActiveScene(ROOM, { eventId: '$ev1', title: 'A scene' });
    clearActiveScene(ROOM);

    expect(localStorage.getItem(KEY)).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('localStorage takes precedence over a stale legacy sessionStorage entry', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ eventId: '$old', title: 'Old' }));
    localStorage.setItem(KEY, JSON.stringify({ eventId: '$new', title: 'New' }));

    const loaded = loadActiveScene(ROOM);

    expect(loaded.eventId).toBe('$new');
    // localStorage hit short-circuits before the legacy fallback runs,
    // so the stale sessionStorage entry is left for the next hydrate to clean.
    expect(sessionStorage.getItem(KEY)).not.toBeNull();
  });
});
