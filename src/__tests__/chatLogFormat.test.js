/**
 * Persona-prefix wire format + log dedup helpers.
 */
import { describe, it, expect } from 'vitest';
import {
  prefixBodyWithPersona,
  bodyAlreadyPrefixed,
  formatSayLogBody,
  formatEmoteLogBody,
  formatSceneRootBody,
} from '../ui/chat-log-format.js';
import { resolveWikiTokens } from '../utils/wikilinks.js';

describe('prefixBodyWithPersona', () => {
  it('Say with persona: `Sora: <tone-body>`', () => {
    expect(prefixBodyWithPersona('[Cheerful] Hi', 'Sora', 'say'))
      .toBe('Sora: [Cheerful] Hi');
  });

  it('Describe with persona: `Sora <verb>`', () => {
    expect(prefixBodyWithPersona('leans against the wall', 'Sora', 'describe'))
      .toBe('Sora leans against the wall');
  });

  it('OOC drops persona regardless', () => {
    expect(prefixBodyWithPersona('pizza in 5', 'Sora', 'ooc')).toBe('pizza in 5');
  });

  it('No persona name → body unchanged', () => {
    expect(prefixBodyWithPersona('hi', null, 'say')).toBe('hi');
    expect(prefixBodyWithPersona('hi', '', 'say')).toBe('hi');
  });
});

describe('bodyAlreadyPrefixed', () => {
  it('say: matches `Sora: …`', () => {
    expect(bodyAlreadyPrefixed('Sora: Hi', 'Sora', 'say')).toBe(true);
    expect(bodyAlreadyPrefixed('Hi', 'Sora', 'say')).toBe(false);
  });

  it('describe: matches `Sora …`', () => {
    expect(bodyAlreadyPrefixed('Sora leans', 'Sora', 'describe')).toBe(true);
    expect(bodyAlreadyPrefixed('leans', 'Sora', 'describe')).toBe(false);
  });

  it('ooc: never matches', () => {
    expect(bodyAlreadyPrefixed('Sora: Hi', 'Sora', 'ooc')).toBe(false);
  });

  it('matches announcement and dice roll prefixes with icon before persona name', () => {
    expect(bodyAlreadyPrefixed('🎲 crb rolled 1d20: **15** (15)', 'crb', 'say')).toBe(true);
    expect(bodyAlreadyPrefixed('⚔ crb attacks the goblin', 'crb', 'say')).toBe(true);
    expect(bodyAlreadyPrefixed('💔 crb takes 5 damage', 'crb', 'say')).toBe(true);
    expect(bodyAlreadyPrefixed('💚 crb heals 5 hp', 'crb', 'say')).toBe(true);
    expect(bodyAlreadyPrefixed('🗺 crb moved token', 'crb', 'say')).toBe(true);
    expect(bodyAlreadyPrefixed('⚔️ Combat ended!', 'crb', 'say')).toBe(true);
  });
});

describe('formatSayLogBody', () => {
  it('persona-prefixed body uses the body verbatim (no displayName prepend)', () => {
    const out = formatSayLogBody('Sora', 'Sora: [Alarmed] Whoah!', 'Sora');
    expect(out).toBe('Sora: [Alarmed] Whoah!');
  });

  it('does not duplicate speaker name when body has announcement or dice icon with persona', () => {
    const out = formatSayLogBody('crb', '🎲 crb rolled 1d20: **15** (15)', null);
    expect(out).toBe('🎲 crb rolled 1d20: <strong>15</strong> (15)');
    expect(out).not.toContain('<b>crb</b>');

    const combatEnd = formatSayLogBody('crb', '⚔️ Combat ended!', null);
    expect(combatEnd).toBe('⚔️ Combat ended!');
    expect(combatEnd).not.toContain('<b>crb</b>');
  });

  it('non-prefixed body falls back to `<b>name</b>: body`', () => {
    const out = formatSayLogBody('Aria', 'hi', null);
    expect(out).toBe('<b>Aria</b>: hi');
  });

  it('escapes HTML in the body', () => {
    const out = formatSayLogBody('Aria', '<script>x</script>', null);
    expect(out).not.toContain('<script>');
  });
});

describe('formatEmoteLogBody', () => {
  it('persona-embedded body → `* <body>`', () => {
    const out = formatEmoteLogBody('Sora', 'Sora leans', 'Sora');
    expect(out).toBe('<i>* Sora leans</i>');
  });

  it('non-prefixed body falls back to `* <b>name</b> body`', () => {
    const out = formatEmoteLogBody('Aria', 'waves', null);
    expect(out).toBe('<i>* <b>Aria</b> waves</i>');
  });
});

describe('markdown and wikilinks rendering in chat', () => {
  it('renders markdown bold **15** and **What do you do?** as strong tags without html envelope', () => {
    const out = formatSayLogBody('Aria', 'Rolled **15**! **What do you do?**', null);
    expect(out).toContain('<strong>15</strong>');
    expect(out).toContain('<strong>What do you do?</strong>');
    expect(out).not.toContain('**15**');
  });

  it('renders [[char:chr-aria]] as an interactive entity preview link when resolved', () => {
    const resolveEntity = {
      refs: {
        characters: new Map([['chr-aria', { name: 'Aria Blackwood' }]]),
      },
    };
    const out = formatSayLogBody('GM', 'Look at [[char:chr-aria]].', null, null, resolveEntity);
    expect(out).toContain('data-preview-kind="character"');
    expect(out).toContain('data-preview-id="chr-aria"');
    expect(out).toContain('Aria Blackwood');
    expect(out).not.toContain('[[char:chr-aria]]');
  });

  it('renders broken wikilinks safely as a broken span instead of raw brackets', () => {
    const out = formatSayLogBody('GM', 'Check [[char:unknown]].', null);
    expect(out).toContain('<span class="wikilink wikilink--broken">char:unknown</span>');
  });

  it('sanitizes malicious markup even with markdown syntax present', () => {
    const out = formatSayLogBody('GM', '**Bold** <script>alert(1)</script>', null);
    expect(out).toContain('<strong>Bold</strong>');
    expect(out).not.toContain('<script>');
  });

  it('resolves [[char:...]] tokens cleanly to character display names or formatted fallback names in narrative scene cards', () => {
    const out = formatSceneRootBody(
      'The Gathering',
      '[[char:chr-aria]] steps forward while [[char:chr-sora]] watches.',
      null,
      { fallback: true },
    );
    expect(out).toContain('data-preview-kind="character"');
    expect(out).toContain('data-preview-id="chr-aria"');
    expect(out).toContain('>Aria<');
    expect(out).toContain('data-preview-id="chr-sora"');
    expect(out).toContain('>Sora<');
    expect(out).not.toContain('[[char:chr-aria]]');
    expect(out).not.toContain('[[char:chr-sora]]');
  });

  it('resolveWikiTokens resolves [[char:chr-aria]] and [[char:chr-sora]] with fallback true by default', () => {
    const html = '<div class="body">[[char:chr-aria]] meets [[char:chr-sora]].</div>';
    const res = resolveWikiTokens(html, { state: {} });
    expect(res).toContain('>Aria<');
    expect(res).toContain('>Sora<');
    expect(res).not.toContain('[[char:chr-aria]]');
  });

  it('strips redundant first line when opening body repeats scene title', () => {
    const out = formatSceneRootBody(
      'Session 3 - Smoke on the Horizon',
      '🎬 Session 3 - Smoke on the Horizon\n\nThe orcs are stalling.',
    );
    expect(out).toContain('<div class="log-entry__scene-title">🎬 Session 3 - Smoke on the Horizon</div>');
    expect(out).toContain('<div class="log-entry__scene-opening">The orcs are stalling.</div>');
    expect(out).not.toContain('<div class="log-entry__scene-opening">🎬 Session 3 - Smoke on the Horizon');
  });

  it('normalizes runtime em-dashes in scene title and opening prose', () => {
    const out = formatSceneRootBody(
      'Session 3 \u2014 Smoke',
      '🎬 Session 3 \u2014 Smoke\n\nThe orcs are stalling \u2014 and smoke rises.',
    );
    expect(out).toContain('Session 3 - Smoke');
    expect(out).not.toContain('\u2014');
    expect(out).toContain('The orcs are stalling - and smoke rises.');
  });
});

