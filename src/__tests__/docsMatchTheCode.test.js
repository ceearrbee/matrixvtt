/**
 * The written record has to describe the system that exists.
 *
 * Both data documents were written before entity state moved into a
 * Yjs document and were never revised, so they described every entity
 * as a `com.vtt.*` state event with an empty-object tombstone. Anyone
 * reading them to learn the system learned the previous one.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { YJS_EVENT_TYPES } from '../utils/constants.js';

const read = (rel) => readFileSync(join(process.cwd(), rel), 'utf8');
const DATA_MODEL = read('docs/DATA-MODEL-SPEC.md');
const EVENT_SCHEMA = read('docs/EVENT-SCHEMA.md');
const SECURITY = read('docs/SECURITY-NOTES.md');

describe('the data documents describe the Yjs model', () => {
  for (const [name, type] of Object.entries(YJS_EVENT_TYPES)) {
    it(`EVENT-SCHEMA.md documents ${name}`, () => {
      expect(EVENT_SCHEMA).toContain(type);
    });
  }

  it('DATA-MODEL-SPEC.md says where entity state actually lives', () => {
    expect(DATA_MODEL.toLowerCase()).toContain('yjs');
  });

  it('names the handout visibility field the code uses', () => {
    expect(DATA_MODEL).toContain('visible_to_players');
    expect(DATA_MODEL).not.toMatch(/`visible_to`/);
  });
});

describe('the confidentiality limit is written down', () => {
  it('SECURITY-NOTES.md says hidden content is not secret', () => {
    expect(SECURITY.toLowerCase()).toMatch(/hidden.*not.*secret|not confidential/);
  });
});

describe('the chunk size in prose matches the chunk size in code', () => {
  const transport = read('src/client/YjsMatrixTransport.js');
  const manager = read('src/state/YjsManager.js');

  it('no docblock claims a 60 KB chunk while the code sends 24 KB', () => {
    const declared = /_MAX_CHUNK_SIZE\s*=\s*(\d+)/.exec(transport)?.[1];
    expect(declared).toBe('24000');
    for (const [name, source] of [['transport', transport], ['manager', manager]]) {
      const prose = source.split('export class')[0];
      expect(prose, `${name} docblock still claims 60 KB`).not.toMatch(/60\s?KB/i);
    }
  });
});
