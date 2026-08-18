/**
 * First-run standalone flows (knock, factory reset, decline/leave) used
 * native window.confirm/prompt while the app ships a real modal stack
 * that already works pre-VTT (room-preview proves it). Native dialogs
 * are unstyled, unthemed, and untrappable for focus management.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { promptKnock } from '../standalone/KnockDialog.jsx';
import { handleFactoryReset } from '../standalone/session.js';

const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

afterEach(() => {
  document.querySelectorAll('.modal-overlay').forEach((n) => n.remove());
});

describe('no native dialogs in standalone first-run paths', () => {
  it.each(['src/standalone/session.js', 'src/standalone/discovery/render.js'])('%s', (file) => {
    const src = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    expect(src).not.toMatch(/window\.(confirm|prompt|alert)\(/);
    expect(src).not.toMatch(/(?<![\w.])(confirm|prompt|alert)\(/);
  });
});

describe('promptKnock', () => {
  it('resolves with the typed reason on Send', async () => {
    const result = promptKnock('!private:hs');
    await flush();

    const input = document.querySelector('[data-knock-reason]');
    expect(input).toBeTruthy();
    input.value = 'Alice from the Tuesday game';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    document.querySelector('[data-confirm]').click();

    expect(await result).toEqual({ ok: true, reason: 'Alice from the Tuesday game' });
  });

  it('resolves ok:false on cancel', async () => {
    const result = promptKnock('!private:hs');
    await flush();
    document.querySelector('[data-cancel]').click();
    expect(await result).toEqual({ ok: false, reason: '' });
  });
});

describe('handleFactoryReset', () => {
  it('requires the typed RESET phrase before wiping anything', async () => {
    localStorage.setItem('vtt:sentinel', '1');
    const app = /** @type {any} */ ({ auth: { userId: '@u:hs' }, win: { location: { reload: vi.fn() } } });

    handleFactoryReset(app);
    await flush();

    const typed = document.querySelector('[data-typed-input]');
    expect(typed).toBeTruthy();
    const confirmBtn = document.querySelector('[data-confirm]');
    expect(confirmBtn.disabled).toBe(true);
    expect(localStorage.getItem('vtt:sentinel')).toBe('1');
    localStorage.removeItem('vtt:sentinel');
  });
});
