/**
 * Tri-state snapshot probe (src/utils/room-snapshot-probe.js#probeRoomSnapshotState).
 *
 * Distinguishes 'present' (room has a usable Yjs snapshot), 'absent'
 * (probe succeeded but found nothing), and 'unknown' (probe errored
 * or returned a non-array). The render-policy stamp self-heal path
 * only invalidates a room-visited stamp on 'absent' - never on
 * 'unknown', so this contract matters for first-load correctness.
 */
import { describe, it, expect } from 'vitest';
import { probeRoomSnapshotState } from '../utils/room-snapshot-probe.js';
import { YJS_EVENT_TYPES } from '../state/YjsManager.js';

const validSnapshot = { content: { data: 'b64', marker: 1 } };

describe('probeRoomSnapshotState - tri-state', () => {
  it("returns 'present' when at least one usable snapshot event exists", async () => {
    const api = { receiveStateEvents: async () => [validSnapshot] };
    expect(await probeRoomSnapshotState(api)).toBe('present');
  });

  it("returns 'absent' on an empty array (room positively confirmed empty)", async () => {
    const api = { receiveStateEvents: async () => [] };
    expect(await probeRoomSnapshotState(api)).toBe('absent');
  });

  it("returns 'unknown' when receiveStateEvents throws (probe error)", async () => {
    const api = { receiveStateEvents: async () => { throw new Error('flaky'); } };
    expect(await probeRoomSnapshotState(api)).toBe('unknown');
  });

  it("returns 'unknown' for a non-array result (defence against contract drift)", async () => {
    const api = { receiveStateEvents: async () => null };
    expect(await probeRoomSnapshotState(api)).toBe('unknown');
  });

  it("returns 'unknown' when no receiveStateEvents method exists", async () => {
    expect(await probeRoomSnapshotState({})).toBe('unknown');
    expect(await probeRoomSnapshotState(null)).toBe('unknown');
    expect(await probeRoomSnapshotState(undefined)).toBe('unknown');
  });

  it("treats events without a marker as not usable → 'absent'", async () => {
    const api = { receiveStateEvents: async () => [{ content: { data: 'b64' /* marker missing */ } }] };
    expect(await probeRoomSnapshotState(api)).toBe('absent');
  });

  it("treats events without data as not usable → 'absent'", async () => {
    const api = { receiveStateEvents: async () => [{ content: { marker: 1 /* data missing */ } }] };
    expect(await probeRoomSnapshotState(api)).toBe('absent');
  });

  it("treats events without content as not usable → 'absent'", async () => {
    const api = { receiveStateEvents: async () => [{ type: YJS_EVENT_TYPES.SNAPSHOT /* no content */ }] };
    expect(await probeRoomSnapshotState(api)).toBe('absent');
  });

  it("mixed array: at least one valid → 'present'", async () => {
    const api = { receiveStateEvents: async () => [
      { content: { data: 'b64' } /* missing marker */ },
      validSnapshot,
      null,
    ] };
    expect(await probeRoomSnapshotState(api)).toBe('present');
  });

  // Probe-vs-loader consistency. The loader (chooseLatestCompleteSnapshot)
  // requires every chunk in a multi-chunk publish to be present before
  // it returns a usable snapshot. Without that, the loader bails and
  // the room renders empty - but if the probe still says 'present',
  // the wizard is suppressed and the user is stranded in a half-broken
  // room. The probe must match the loader's definition of "usable".
  it("partial multi-chunk publish (1 of 2 chunks) → 'absent'", async () => {
    const api = { receiveStateEvents: async () => [
      { content: { data: 'b64', marker: 1779229650296, idx: 0, total: 2 } },
      // chunk 1 of 2 missing - matches the rate-limited publish scenario
    ] };
    expect(await probeRoomSnapshotState(api)).toBe('absent');
  });

  it("complete multi-chunk publish (2 of 2 chunks) → 'present'", async () => {
    const api = { receiveStateEvents: async () => [
      { content: { data: 'b64a', marker: 1779229650296, idx: 0, total: 2 } },
      { content: { data: 'b64b', marker: 1779229650296, idx: 1, total: 2 } },
    ] };
    expect(await probeRoomSnapshotState(api)).toBe('present');
  });

  it("partial newer marker + complete older marker → 'present' (loader picks older)", async () => {
    const api = { receiveStateEvents: async () => [
      // Older complete snapshot:
      { content: { data: 'old0', marker: 1779100000000, idx: 0, total: 1 } },
      // Newer half-published snapshot:
      { content: { data: 'new0', marker: 1779229650296, idx: 0, total: 2 } },
    ] };
    expect(await probeRoomSnapshotState(api)).toBe('present');
  });
});
