/**
 * emojisJson.test.js - validates the structure and coverage of src/content/emojis.json.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import emojis from '../content/emojis.json' with { type: 'json' };

const __dirname = dirname(fileURLToPath(import.meta.url));

const KNOWN_CATEGORIES = ['people', 'nature', 'food', 'activity', 'travel', 'objects', 'symbols', 'flags'];

describe('emojis.json', () => {
  it('is an array', () => {
    expect(Array.isArray(emojis)).toBe(true);
  });

  it('every entry has char (string, non-empty)', () => {
    for (const entry of emojis) {
      expect(typeof entry.char).toBe('string');
      expect(entry.char.length).toBeGreaterThan(0);
    }
  });

  it('every entry has name (string, non-empty)', () => {
    for (const entry of emojis) {
      expect(typeof entry.name).toBe('string');
      expect(entry.name.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a valid category', () => {
    for (const entry of emojis) {
      expect(KNOWN_CATEGORIES).toContain(entry.category);
    }
  });

  it('every entry has aliases (array, possibly empty)', () => {
    for (const entry of emojis) {
      expect(Array.isArray(entry.aliases)).toBe(true);
    }
  });

  it('file size is under 50000 bytes', () => {
    const filePath = resolve(__dirname, '../content/emojis.json');
    const { size } = readFileSync(filePath);
    // readFileSync returns a Buffer; use .length for size
    const fileContent = readFileSync(filePath);
    expect(fileContent.length).toBeLessThan(50000);
  });

  it('has at least one entry per category', () => {
    for (const cat of KNOWN_CATEGORIES) {
      const found = emojis.some((e) => e.category === cat);
      expect(found, `Expected at least one entry for category "${cat}"`).toBe(true);
    }
  });
});
