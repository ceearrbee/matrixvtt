/**
 * Structural lock-in for "why" comments next to load-bearing code.
 *
 * A prior cleanup pass trimmed verbose theoretical preambles in the
 * Yjs / Matrix modules. That trim was correct for the generic CRDT-
 * theory framing, but the trimmed text also carried the *specific*
 * rationale for two pieces of code that look arbitrary without
 * context:
 *
 *   1. YjsMatrixTransport chunks Yjs updates at 60KB. Without
 *      knowing that Matrix homeservers enforce ~64KB per-event
 *      payload limits, a future reader could plausibly "simplify"
 *      the chunking out and ship a sync regression.
 *   2. MatrixClient throttles per-event-type sends. Without knowing
 *      that homeservers respond with 429 on burst sends, that block
 *      reads as gratuitous complexity over matrix-js-sdk.
 *
 * These tests assert the rationale strings exist near the relevant
 * code so the WHY can't drift out of the file under a future trim.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');

describe('rationale comments - Yjs chunking', () => {
  it('YjsMatrixTransport documents the 64 KB Matrix payload cap near MAX_CHUNK_SIZE', () => {
    const src = readFileSync(resolve(ROOT, 'client/YjsMatrixTransport.js'), 'utf8');
    expect(src).toMatch(/MAX_CHUNK_SIZE/);
    // The "64 KB" string should appear in the file as the rationale.
    expect(src, 'YjsMatrixTransport chunking rationale (64 KB) is missing').toMatch(/64\s*KB/i);
  });

  it('YjsManager documents the same constraint at the reassembly side', () => {
    const src = readFileSync(resolve(ROOT, 'state/YjsManager.js'), 'utf8');
    expect(src, 'YjsManager 64 KB rationale missing').toMatch(/64\s*KB/i);
  });
});

describe('rationale comments - MatrixClient throttling', () => {
  it('MatrixClient explains the 429 rate-limit reason for per-event-type throttling', () => {
    const src = readFileSync(resolve(ROOT, 'client/MatrixClient.js'), 'utf8');
    expect(src).toMatch(/_throttles/);
    // Either the literal "429" or the phrase "rate-limit" must appear
    // alongside the throttling block. Both are equally informative.
    expect(src, 'MatrixClient throttling rationale (429 / rate-limit) is missing').toMatch(/429|rate.?limit/i);
  });
});
