/**
 * yjs and lib0 were bundled into chat-integrator, the chunk that changes
 * every deploy, so every deploy re-downloaded the library that changes
 * least. Splitting them out creates a chunk no size-limit entry watches,
 * which is the same miss again. Pin both: the group exists, and every
 * manual chunk is either budgeted or listed here as a deliberate omission.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { MANUAL_CHUNKS } from '../../vite.chunks.js';

const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../package.json'), 'utf8'));
const budgets = pkg['size-limit'];
const budgetedPaths = budgets.map((entry) => entry.path);

const UNBUDGETED = [
  'rxjs',
  'preact',
  'sonner',
  'marked',
  'fuse',
  'driver',
  'dnd-kit',
  'tinykeys',
  'focus-trap',
  'p-retry',
  'valibot',
  'dompurify',
  'idb-keyval',
];

describe('manual chunk budgets', () => {
  it('gives yjs its own long-lived chunk', () => {
    const group = MANUAL_CHUNKS.find(([name]) => name === 'yjs-runtime');
    expect(group?.[1]).toEqual(['yjs', 'lib0', 'y-protocols']);
  });

  it('watches the yjs chunk it just created', () => {
    const entry = budgets.find((b) => b.path === 'dist/assets/yjs-runtime-*.js');
    expect(entry).toBeDefined();
    expect(entry.limit).toBe('25 kB');
  });

  it('leaves no manual chunk unwatched without saying so', () => {
    const unwatched = MANUAL_CHUNKS.map(([name]) => name).filter(
      (name) => !budgetedPaths.includes(`dist/assets/${name}-*.js`)
    );
    expect(unwatched).toEqual(UNBUDGETED);
  });

  it('holds the chat-integrator limit where four bumps left it', () => {
    const entry = budgets.find((b) => b.name === 'chat-integrator chunk');
    expect(entry.limit).toBe('190 kB');
  });
});
