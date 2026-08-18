import { describe, it, expect } from 'vitest';
import {
  splitBinaryToChunks, joinChunks, chooseLatestCompleteSnapshot,
  base64ToBytes, bytesToBase64, SNAPSHOT_CHUNK_BYTES,
} from '../snapshot-chunks.js';

function randomBytes(n) {
  const a = new Uint8Array(n);
  for (let i = 0; i < n; i++) a[i] = (Math.random() * 256) | 0;
  return a;
}

describe('splitBinaryToChunks', () => {
  it('returns the whole buffer as one chunk when smaller than maxBytes', () => {
    const b = new Uint8Array([1, 2, 3]);
    const chunks = splitBinaryToChunks(b, 100);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual(b);
  });

  it('splits at exact boundaries', () => {
    const b = new Uint8Array(64); for (let i = 0; i < 64; i++) b[i] = i;
    const chunks = splitBinaryToChunks(b, 16);
    expect(chunks).toHaveLength(4);
    for (let i = 0; i < 4; i++) expect(chunks[i].length).toBe(16);
  });

  it('handles non-multiple sizes', () => {
    const b = new Uint8Array(17);
    const chunks = splitBinaryToChunks(b, 5);
    expect(chunks.map((c) => c.length)).toEqual([5, 5, 5, 2]);
  });

  it('returns one empty chunk for empty input', () => {
    expect(splitBinaryToChunks(new Uint8Array(0))).toHaveLength(1);
    expect(splitBinaryToChunks(new Uint8Array(0))[0].length).toBe(0);
  });

  it('round-trips large random binaries via split + join (bytewise identical)', () => {
    const original = randomBytes(200_000);
    const chunks = splitBinaryToChunks(original, SNAPSHOT_CHUNK_BYTES);
    expect(chunks.length).toBeGreaterThan(1);
    const rejoined = joinChunks(chunks);
    expect(rejoined.length).toBe(original.length);
    for (let i = 0; i < original.length; i++) {
      if (rejoined[i] !== original[i]) {
        throw new Error(`mismatch at byte ${i}`);
      }
    }
  });

  it('exact-boundary sizes round-trip', () => {
    for (const n of [SNAPSHOT_CHUNK_BYTES - 1, SNAPSHOT_CHUNK_BYTES, SNAPSHOT_CHUNK_BYTES + 1]) {
      const o = randomBytes(n);
      const r = joinChunks(splitBinaryToChunks(o));
      expect(r.length, `n=${n}`).toBe(n);
    }
  });

  it('rejects bad inputs', () => {
    expect(() => splitBinaryToChunks(/** @type {any} */ ('nope'))).toThrow(TypeError);
    expect(() => splitBinaryToChunks(new Uint8Array(1), 0)).toThrow(RangeError);
  });
});

describe('base64 round-trip', () => {
  it('bytesToBase64 then base64ToBytes recovers the original', () => {
    const o = randomBytes(40_000); // larger than apply.call's CHUNK
    const r = base64ToBytes(bytesToBase64(o));
    expect(r.length).toBe(o.length);
    for (let i = 0; i < o.length; i++) if (r[i] !== o[i]) throw new Error('mismatch');
  });
});

describe('chooseLatestCompleteSnapshot', () => {
  function ev(marker, idx, total, data = 'x') {
    return { content: { data, marker, idx, total } };
  }

  it('returns null on empty list', () => {
    expect(chooseLatestCompleteSnapshot([])).toBeNull();
    expect(chooseLatestCompleteSnapshot(null)).toBeNull();
  });

  it('returns null when no marker is complete', () => {
    const events = [ev(1, 0, 3), ev(1, 1, 3)]; // missing idx=2
    expect(chooseLatestCompleteSnapshot(events)).toBeNull();
  });

  it('picks a complete single-chunk snapshot', () => {
    const got = chooseLatestCompleteSnapshot([ev(5, 0, 1, 'A')]);
    expect(got).toEqual({ marker: 5, chunks: [{ idx: 0, data: 'A' }] });
  });

  it('falls back to lower complete marker when higher is incomplete', () => {
    const events = [
      ev(10, 0, 3), ev(10, 2, 3),  // missing idx=1 - incomplete
      ev(5,  0, 2), ev(5,  1, 2),  // complete
    ];
    const got = chooseLatestCompleteSnapshot(events);
    expect(got.marker).toBe(5);
  });

  it('treats legacy events (no idx/total) as a 1-chunk group', () => {
    // The original publish used state_key="" and content={data, marker}.
    const got = chooseLatestCompleteSnapshot([{ content: { data: 'legacy', marker: 99 } }]);
    expect(got).toEqual({ marker: 99, chunks: [{ idx: 0, data: 'legacy' }] });
  });

  it('skips malformed events (no data, wrong types)', () => {
    const events = [
      { content: {} },
      { content: { data: 'x' } },                          // no marker
      { content: { data: 'x', marker: 'oops' } },          // wrong type
      ev(1, 0, 1, 'real'),
    ];
    const got = chooseLatestCompleteSnapshot(events);
    expect(got.marker).toBe(1);
  });

  it('handles duplicate (marker, idx) by last-write-wins', () => {
    // Two writes for the same chunk - second wins. Both are complete groups
    // (single chunk), so the marker chosen is still 1.
    const events = [ev(1, 0, 1, 'first'), ev(1, 0, 1, 'second')];
    const got = chooseLatestCompleteSnapshot(events);
    expect(got.chunks[0].data).toBe('second');
  });
});
