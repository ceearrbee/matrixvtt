/**
 * Setup-wizard durability gate: if the campaign snapshot fails to publish
 * (e.g. homeserver rate limit), runSetupFlow must NOT finalize - it must throw
 * so the wizard stays open for a retry, rather than closing onto a fragile
 * room that re-fires the wizard (and loses the seeded campaign) on reload.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../ui/import-export.js', () => ({ importCampaign: vi.fn() }));
vi.mock('../ui/progress-modal.js', () => ({
  // Execute each phase's run() so the snapshot phase actually runs (and can throw).
  runWithProgress: async (phases) => { for (const p of phases) await p.run(() => {}, () => {}); },
  waitForQueueDrain: async () => {},
}));
vi.mock('../ui/setup-tombstone.js', () => ({
  tombstoneStaleEvents: vi.fn().mockResolvedValue(undefined),
  _fetchStaleVttEvents: vi.fn().mockResolvedValue([]),
}));
vi.mock('../ui/setup-persistence.js', () => ({
  saveInitialState: vi.fn().mockResolvedValue(undefined),
  verifyInitialSave: vi.fn().mockResolvedValue({ verified: true, discrepancies: [] }),
  countInitialSaveSteps: () => 0,
}));
vi.mock('../ui/onboarding-tour.js', () => ({ maybeAutoStartTour: vi.fn() }));
vi.mock('../ui/scene-mode.js', () => ({ startScene: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../state/yjs-snapshot-publish.js', () => ({ publishYjsSnapshot: vi.fn() }));

import { runSetupFlow } from '../ui/setup/save-flow.js';
import { publishYjsSnapshot } from '../state/yjs-snapshot-publish.js';

function makeUi() {
  return /** @type {any} */ ({
    state: {
      setCleaningUp: vi.fn(),
      initBlankCampaign: vi.fn(),
      settings: { name: 'Test Campaign', systemConfig: {} },
    },
    activityLog: ['SENTINEL'],
    _seenLogEventIds: new Set(['keep']),
    _toast: vi.fn(),
    updateMapPanel: vi.fn(),
  });
}

beforeEach(() => vi.clearAllMocks());

describe('runSetupFlow snapshot durability gate', () => {
  it('does NOT finalize when the snapshot publish fails', async () => {
    vi.mocked(publishYjsSnapshot).mockResolvedValue(false);
    const onDone = vi.fn();
    const ui = makeUi();

    await expect(runSetupFlow(ui, { kind: 'blank' }, onDone)).rejects.toThrow(/snapshot/i);

    expect(onDone).not.toHaveBeenCalled();          // wizard stays open
    expect(ui.activityLog).toEqual(['SENTINEL']);   // not cleared
    expect(ui.state.setCleaningUp).toHaveBeenLastCalledWith(false); // cleanup still released
  });

  it('finalizes when the snapshot publish succeeds', async () => {
    vi.mocked(publishYjsSnapshot).mockResolvedValue(true);
    const onDone = vi.fn();
    const ui = makeUi();

    await runSetupFlow(ui, { kind: 'blank' }, onDone);

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(ui.activityLog).toEqual([]); // cleared on success
  });
});
