import { describe, it, expect } from 'vitest';
import { allocateEntityId } from '../utils/stable-id.js';

describe('allocateEntityId', () => {
  it('returns prefix-1 for an empty collection', async () => {
    expect(await allocateEntityId('tok', new Map())).toBe('tok-1');
  });

  it('finds the lowest unused positional slot', async () => {
    const m = new Map([['tok-1', {}], ['tok-3', {}]]);
    expect(await allocateEntityId('tok', m)).toBe('tok-2');
  });

  it('skips existing non-positional IDs', async () => {
    const m = new Map([['tok-1', {}], ['tok-abc', {}], ['tok-2', {}]]);
    expect(await allocateEntityId('tok', m)).toBe('tok-3');
  });

  it('reuses a slot after the previous occupant was removed', async () => {
    const m = new Map([['tok-1', {}], ['tok-2', {}]]);
    m.delete('tok-1');
    expect(await allocateEntityId('tok', m)).toBe('tok-1');
  });

  it('falls back to a timestamp when maxScan is exceeded', async () => {
    const m = new Map();
    for (let i = 1; i <= 5; i++) m.set(`tok-${i}`, {});
    const id = await allocateEntityId('tok', m, 5);
    expect(id).toMatch(/^tok-\d{10,}$/);
  });

  it('respects the prefix argument', async () => {
    expect(await allocateEntityId('chr', new Map())).toBe('chr-1');
    expect(await allocateEntityId('handout', new Map([['handout-1', {}]]))).toBe('handout-2');
  });
});
