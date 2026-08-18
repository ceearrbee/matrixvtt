/**
 * CompendiumBrowser modal body: loads the compendium lazily, filters by
 * name and secondary facet, caps results with a refine note, adds rows
 * through the per-kind writer, and shows the SRD attribution.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/preact';
import { CompendiumBrowser } from '../ui/compendium/CompendiumBrowser.jsx';

const SPELLS = Array.from({ length: 60 }, (_, i) => ({
  id: `srd-sp-spell-${i}`,
  name: i === 0 ? 'Fireball' : `Spell ${i}`,
  level: i % 10,
  school: 'Evocation',
}));

function makePayload(entries = SPELLS) {
  return {
    spells: {
      meta: { attribution: 'This work includes material taken from the SRD 5.1.' },
      entries,
    },
  };
}

function makeUi() {
  const character = { id: 'chr-1', name: 'Aria', spell_ids: [] };
  return {
    state: {
      isGM: () => false,
      spells: new Map(),
      items: new Map(),
      npcs: new Map(),
      getCurrentCharacter: () => character,
      getCurrentCharacterId: () => 'chr-1',
      updateSpell: vi.fn(async () => {}),
      updateCharacter: vi.fn(async () => {}),
    },
    _toast: vi.fn(),
  };
}

afterEach(cleanup);

describe('CompendiumBrowser', () => {
  it('shows a loading state until the compendium resolves', () => {
    const load = () => new Promise(() => {});
    const { container } = render(h(CompendiumBrowser, { ui: makeUi(), kind: 'spell', load }));
    expect(container.querySelector('[data-compendium-loading]')).not.toBeNull();
  });

  it('renders capped rows plus a refine note once loaded', async () => {
    const load = async () => makePayload();
    const { container } = render(h(CompendiumBrowser, { ui: makeUi(), kind: 'spell', load }));
    await waitFor(() => {
      expect(container.querySelectorAll('[data-compendium-row]').length).toBe(50);
    });
    expect(container.querySelector('[data-compendium-more]').textContent).toContain('10 more');
  });

  it('filters rows by name through the search input', async () => {
    const load = async () => makePayload();
    const { container } = render(h(CompendiumBrowser, { ui: makeUi(), kind: 'spell', load }));
    await waitFor(() => expect(container.querySelector('[data-compendium-row]')).not.toBeNull());
    const input = container.querySelector('#compendium-search');
    input.value = 'fireball';
    fireEvent.input(input, { target: input });
    const rows = container.querySelectorAll('[data-compendium-row]');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Fireball');
    expect(container.querySelector('[data-compendium-more]')).toBeNull();
  });

  it('filters by the secondary facet (spell level)', async () => {
    const load = async () => makePayload();
    const { container } = render(h(CompendiumBrowser, { ui: makeUi(), kind: 'spell', load }));
    await waitFor(() => expect(container.querySelector('[data-compendium-row]')).not.toBeNull());
    const select = container.querySelector('#compendium-facet');
    select.value = '9';
    // No `target:` init here: re-assigning the element's own properties
    // through fireEvent resets a happy-dom select to its first option.
    fireEvent.change(select);
    const rows = container.querySelectorAll('[data-compendium-row]');
    expect(rows.length).toBe(6);
    for (const row of rows) expect(row.textContent).toContain('Level 9');
  });

  it('Add writes through the kind writer', async () => {
    const ui = makeUi();
    const load = async () => makePayload();
    const { container } = render(h(CompendiumBrowser, { ui, kind: 'spell', load }));
    await waitFor(() => expect(container.querySelector('[data-compendium-row]')).not.toBeNull());
    const input = container.querySelector('#compendium-search');
    input.value = 'fireball';
    fireEvent.input(input, { target: input });
    fireEvent.click(container.querySelector('[data-compendium-row] button'));
    await waitFor(() => expect(ui.state.updateSpell).toHaveBeenCalled());
    expect(ui.state.updateSpell).toHaveBeenCalledWith('srd-sp-spell-0', expect.objectContaining({ name: 'Fireball' }));
  });

  it('shows the attribution line from meta', async () => {
    const load = async () => makePayload();
    const { container } = render(h(CompendiumBrowser, { ui: makeUi(), kind: 'spell', load }));
    await waitFor(() => expect(container.querySelector('[data-compendium-row]')).not.toBeNull());
    expect(container.querySelector('.compendium-attribution').textContent)
      .toContain('SRD 5.1');
  });

  it('shows an inline failure state when the load rejects', async () => {
    const load = async () => { throw new Error('offline'); };
    const { container } = render(h(CompendiumBrowser, { ui: makeUi(), kind: 'spell', load }));
    await waitFor(() => {
      expect(container.querySelector('[data-compendium-error]')).not.toBeNull();
    });
  });
});
