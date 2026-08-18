/**
 * The inline-help registry existed to fix a vocabulary problem, yet 7
 * of its 10 authored entries had no HelpIcon call site - dead copy.
 * Every remaining term must be wired somewhere in src/ui; terms with
 * no sensible home (prep, walls, lights, templates - toolbar tools
 * whose tooltips already explain them) are deleted, not stockpiled.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { HELP_TERMS } from '../ui/help-terms.js';

function uiSources() {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!full.includes('__tests__')) walk(full);
      } else if (/\.(js|jsx)$/.test(entry.name)) {
        out.push(fs.readFileSync(full, 'utf8'));
      }
    }
  };
  walk(path.join(process.cwd(), 'src/ui'));
  return out.join('\n');
}

describe('help-term coverage', () => {
  const sources = uiSources();

  it('every registered term has a HelpIcon call site', () => {
    const unwired = Object.keys(HELP_TERMS).filter(
      (term) => !new RegExp(`term:\\s*['"]${term}['"]`).test(sources),
    );
    expect(unwired).toEqual([]);
  });

  it('the homeless entries are deleted, not stockpiled', () => {
    for (const gone of ['prep', 'walls', 'lights', 'templates']) {
      expect(HELP_TERMS[gone], `${gone} should be deleted`).toBeUndefined();
    }
  });

  it('the conversational terms are wired', () => {
    for (const term of ['scene', 'ooc', 'persona']) {
      expect(HELP_TERMS[term], `${term} missing from registry`).toBeDefined();
    }
  });
});
