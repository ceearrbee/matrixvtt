/**
 * The GM-facing control for whether combat comes with a map switch, and
 * the map-size cap that the upload path has always read from settings
 * with no way to set it.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/preact';
import { h } from 'preact';
import { useRef } from 'preact/hooks';
import { CampaignSettings } from '../ui/settings/GMSettings.jsx';

function Harness({ settings }) {
  const refs = {
    name: useRef(null), system: useRef(null), grid: useRef(null), gridType: useRef(null),
    gms: useRef(null), combatFollowsMap: useRef(null), maxMapDim: useRef(null),
  };
  const ui = { state: { settings: { name: 'C', gm_user_ids: [], grid_px: 40, ...settings } } };
  return h(CampaignSettings, { ui, refs });
}

const render1 = (settings = {}) => render(h(Harness, { settings })).container;

describe('combat-follows-map control', () => {
  it('is a checkbox the GM can find', () => {
    const box = render1().querySelector('#settings-combat-follows-map');
    expect(box).toBeTruthy();
    expect(box.type).toBe('checkbox');
  });

  it('is on by default, which is the behaviour that shipped', () => {
    expect(render1().querySelector('#settings-combat-follows-map').checked).toBe(true);
  });

  it('reflects the setting when the GM has turned it off', () => {
    expect(render1({ combat_follows_map: false }).querySelector('#settings-combat-follows-map').checked).toBe(false);
  });

  it('explains what turning it off does', () => {
    const hint = render1().querySelector('[data-hint-for="combat-follows-map"]');
    expect(hint.textContent).toMatch(/end/i);
  });
});

describe('max map dimension control', () => {
  it('exposes the cap the upload path already reads', () => {
    const input = render1().querySelector('#settings-max-map-dim');
    expect(input).toBeTruthy();
    expect(input.type).toBe('number');
  });

  it('shows the default the uploader uses when nothing is set', () => {
    expect(render1().querySelector('#settings-max-map-dim').value).toBe('2048');
  });

  it('shows what the GM chose', () => {
    expect(render1({ max_map_dim: 1024 }).querySelector('#settings-max-map-dim').value).toBe('1024');
  });
});
