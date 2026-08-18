/**
 * Yjs doc diagnostics for Settings > About: encoded size, client-id
 * count, and total operation clock. Doc compaction is measurement-
 * gated; this readout is the instrument, not the compaction.
 */

import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import fs from 'node:fs';
import { yjsDocDiagnostics, formatBytes } from '../state/yjs-diagnostics.js';

describe('yjsDocDiagnostics', () => {
  it('reports encoded size, client count, and total operations', () => {
    const doc = new Y.Doc();
    doc.getMap('tokens').set('a', 1);
    doc.getMap('tokens').set('b', { x: 2 });
    const d = yjsDocDiagnostics(doc);
    expect(d.encodedBytes).toBeGreaterThan(0);
    expect(d.clients).toBe(1);
    expect(d.totalClock).toBeGreaterThanOrEqual(2);
  });

  it('sums clocks across client ids', () => {
    const a = new Y.Doc();
    a.getMap('m').set('k', 1);
    const b = new Y.Doc();
    b.getMap('m').set('other', 2);
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    const d = yjsDocDiagnostics(b);
    expect(d.clients).toBe(2);
  });

  it('returns null without a doc', () => {
    expect(yjsDocDiagnostics(null)).toBeNull();
    expect(yjsDocDiagnostics(undefined)).toBeNull();
  });
});

describe('formatBytes', () => {
  it('scales through B, KB, MB', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('About panel wiring', () => {
  it('renders the diagnostics readout', () => {
    const src = fs.readFileSync('src/ui/Settings.jsx', 'utf8');
    expect(src).toContain('yjsDocDiagnostics');
    expect(src).toContain('data-yjs-diagnostics');
  });
});
