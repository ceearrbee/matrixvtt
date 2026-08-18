/**
 * Migration sweep: legacy `vtt:calmer-view` localStorage entries are
 * cleared on the first `hydratePhase` call. Calmer view is gone - its
 * UX is subsumed by Exploration mode - so the old keys are dead weight
 * and should not influence anything after this build ships.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { hydratePhase } from '../ui/ui-mode.js';

describe('legacy vtt:calmer-view migration', () => {
  beforeEach(() => { localStorage.clear(); });

  it('removes vtt:calmer-view::<userId> entries on hydrate', () => {
    localStorage.setItem('vtt:calmer-view::@alice:m', '1');
    localStorage.setItem('vtt:calmer-view::@bob:m', '1');
    localStorage.setItem('vtt:calmer-view', '1');
    localStorage.setItem('vtt:ui-mode:!r:m::@alice:m', 'narrative');

    hydratePhase('@alice:m', '!r:m', false);

    expect(localStorage.getItem('vtt:calmer-view::@alice:m')).toBeNull();
    expect(localStorage.getItem('vtt:calmer-view::@bob:m')).toBeNull();
    expect(localStorage.getItem('vtt:calmer-view')).toBeNull();
    // hydratePhase also sweeps the legacy mode key as part of the one-shot migration.
    expect(localStorage.getItem('vtt:ui-mode:!r:m::@alice:m')).toBeNull();
  });
});
