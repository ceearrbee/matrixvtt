/**
 * Assorted semantics debt: Matrix protocol jargon on the app's
 * most-used control, hand-rolled dialogs without accessible names, a
 * command palette that never announces its results, and the earned-
 * eyebrow rule drifting onto routine chrome.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

afterEach(() => {
  document.body.innerHTML = '';
});

describe('composer mode pills', () => {
  it('carry no Matrix protocol jargon in their tooltips', () => {
    const src = read('src/ui/Composer.jsx');
    expect(src).not.toMatch(/m\.text|m\.emote|m\.notice/);
  });
});

describe('welcome dialogs accessible names', () => {
  it('PlayerWelcome and WaitingForGM dialogs are labelled by their headings', async () => {
    const { showPlayerWelcome, showWaitingForGM } = await import('../ui/WelcomeModals.jsx');
    const ui = /** @type {any} */ ({ widgetManager: { isAppClient: false }, showFirstTimeSetup: vi.fn() });

    showPlayerWelcome(ui);
    showWaitingForGM(ui, true);
    await flush();

    const dialogs = [...document.querySelectorAll('[role="dialog"]')];
    expect(dialogs.length).toBe(2);
    for (const dialog of dialogs) {
      const labelId = dialog.getAttribute('aria-labelledby');
      expect(labelId, 'dialog missing aria-labelledby').toBeTruthy();
      expect(document.getElementById(labelId)?.textContent?.length).toBeGreaterThan(3);
    }
  });
});

describe('command palette announcements', () => {
  it('announces the result count through a polite live region', async () => {
    const { showCommandPalette } = await import('../ui/command-palette.js');
    const ui = /** @type {any} */ ({
      state: {
        tokens: new Map(), npcs: new Map(), items: new Map(), spells: new Map(),
        handouts: new Map(), tables: new Map(),
        characters: new Map([
          ['c1', { id: 'c1', name: 'Aran' }],
          ['c2', { id: 'c2', name: 'Brindle' }],
        ]),
      },
    });
    showCommandPalette(ui);
    await flush();

    const live = document.querySelector('#cp-live');
    expect(live).toBeTruthy();
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.textContent).toMatch(/2 results/i);

    const input = document.querySelector('#cp-input');
    input.value = 'zzz-no-match';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    expect(live.textContent).toMatch(/no matches/i);

    document.querySelectorAll('.modal-overlay').forEach((n) => n.remove());
  });
});

describe('the earned eyebrow rule', () => {
  it.each([
    'src/ui/PartyRoster.jsx',
    'src/ui/IconRail.jsx',
    'src/ui/Settings.jsx',
  ])('%s keeps eyebrow treatment off routine chrome', (file) => {
    const src = read(file);
    // The scene-card eyebrow in LogPanel stays: a scene banner is an
    // earned editorial moment; these are everyday panel labels.
    expect(src).not.toMatch(/class[=:]\s*['"`][^'"`]*eyebrow/);
  });

  it('the BEM eyebrow styles lose the uppercase display treatment', () => {
    const css = read('src/styles.css');
    for (const cls of ['party-roster__eyebrow', 'icon-rail__drawer-eyebrow']) {
      const m = css.match(new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`));
      if (!m) continue;
      expect(m[1], `${cls} keeps uppercase tracking`).not.toContain('uppercase');
    }
  });
});
