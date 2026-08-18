import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openProgress, runWithProgress } from '../ui/progress-modal.js';
import { VTT_EVENTS } from '../utils/constants.js';

describe('progress-modal', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => { document.body.innerHTML = ''; });

  it('renders title, counter and a zeroed progress bar', () => {
    openProgress({ title: 'Deleting session', total: 3 });
    const card = document.querySelector('.progress-card');
    expect(card).not.toBeNull();
    expect(card.querySelector('.progress-card__title').textContent).toBe('Deleting session');
    expect(card.querySelector('.progress-card__count').textContent).toBe('0 / 3');
    expect(card.querySelector('.progress-bar__fill').style.width).toBe('0%');
  });

  it('update() advances counter and bar width', () => {
    const p = openProgress({ title: 't', total: 3 });
    p.update(1, 'step one');
    const card = document.querySelector('.progress-card');
    expect(card.querySelector('.progress-card__count').textContent).toBe('1 / 3');
    // 1/3 ≈ 33.33%
    expect(card.querySelector('.progress-bar__fill').style.width).toMatch(/^33\./);
    expect(card.querySelector('.progress-card__detail').textContent).toBe('step one');
  });

  it('setTotal() resets the counter', () => {
    const p = openProgress({ title: 't', total: 3 });
    p.update(2);
    p.setTotal(10);
    const card = document.querySelector('.progress-card');
    expect(card.querySelector('.progress-card__count').textContent).toBe('0 / 10');
    expect(card.querySelector('.progress-bar__fill').style.width).toBe('0%');
  });

  it('fail() marks the card failed and shows a dismiss button', () => {
    const p = openProgress({ title: 't', total: 1 });
    p.fail('boom');
    const card = document.querySelector('.progress-card');
    expect(card.classList.contains('progress-card--failed')).toBe(true);
    expect(card.querySelector('.progress-card__detail').textContent).toBe('boom');
    const dismiss = card.querySelector('button');
    expect(dismiss).not.toBeNull();
    dismiss.click();
    expect(document.querySelector('.progress-card')).toBeNull();
  });

  it('close() removes the card', () => {
    const p = openProgress({ title: 't', total: 1 });
    p.close();
    expect(document.querySelector('.progress-card')).toBeNull();
  });

  it('shows the rate-limit subtitle with phase + remaining + wait', () => {
    const p = openProgress({ title: 'Saving campaign', total: 10 });
    p.update(3);
    window.dispatchEvent(new CustomEvent(VTT_EVENTS.RATE_LIMITED, { detail: { retryAfter: 5000 } }));
    const rl = document.querySelector('.progress-card__rate-limit');
    expect(rl.style.display).toBe('');
    expect(rl.textContent).toContain('Saving campaign');
    expect(rl.textContent).toContain('7 writes left');
    expect(rl.textContent).toContain('5s');
  });

  it('updates the rate-limit remaining count as writes complete', () => {
    const p = openProgress({ title: 'Clearing previous session', total: 4 });
    window.dispatchEvent(new CustomEvent(VTT_EVENTS.RATE_LIMITED, { detail: { retryAfter: 3000 } }));
    p.update(3);
    expect(document.querySelector('.progress-card__rate-limit').textContent).toContain('1 write left');
  });

  it('hides the rate-limit subtitle when retryAfter clears', () => {
    openProgress({ title: 't', total: 1 });
    window.dispatchEvent(new CustomEvent(VTT_EVENTS.RATE_LIMITED, { detail: { retryAfter: 5000 } }));
    window.dispatchEvent(new CustomEvent(VTT_EVENTS.RATE_LIMITED, { detail: { retryAfter: 0 } }));
    expect(document.querySelector('.progress-card__rate-limit').style.display).toBe('none');
  });

  it('runWithProgress walks phases and closes on success', async () => {
    const phaseOne = [];
    const phaseTwo = [];
    await runWithProgress([
      { title: 'phase 1', total: 2, run: async (onP) => { onP(1); phaseOne.push(1); onP(2); phaseOne.push(2); } },
      { title: 'phase 2', total: 3, run: async (onP) => { onP(1); phaseTwo.push(1); onP(3); phaseTwo.push(3); } },
    ]);
    expect(phaseOne).toEqual([1, 2]);
    expect(phaseTwo).toEqual([1, 3]);
    expect(document.querySelector('.progress-card')).toBeNull();
  });

  it('runWithProgress fails the card on throw and rethrows', async () => {
    await expect(runWithProgress([
      { title: 'p', total: 1, run: async () => { throw new Error('kaboom'); } },
    ])).rejects.toThrow('kaboom');
    const card = document.querySelector('.progress-card');
    expect(card).not.toBeNull();
    expect(card.classList.contains('progress-card--failed')).toBe(true);
    expect(card.querySelector('.progress-card__detail').textContent).toBe('kaboom');
  });
});
