/**
 * ItemPicker - `<select>` over ui.state.items.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, h } from 'preact';
import { ItemPicker } from '../ui/tables/ItemPicker.jsx';

describe('<ItemPicker>', () => {
  let host;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });
  afterEach(() => {
    render(null, host);
    host.remove();
  });

  function items(map) {
    return new Map(Object.entries(map));
  }

  it('renders an empty option plus one option per item, sorted by name', () => {
    const map = items({
      'itm-z': { name: 'Zebra' },
      'itm-a': { name: 'Apple' },
      'itm-m': { name: 'Mango' },
    });
    render(h(ItemPicker, { items: map, onChange: () => {} }), host);
    const opts = [...host.querySelectorAll('option')].map(o => o.textContent);
    expect(opts[0]).toMatch(/none/i);
    expect(opts.slice(1)).toEqual(['Apple', 'Mango', 'Zebra']);
  });

  it('selecting an item invokes onChange with the id', () => {
    const map = items({ 'itm-a': { name: 'Apple' } });
    const onChange = vi.fn();
    render(h(ItemPicker, { items: map, onChange }), host);
    const sel = host.querySelector('select');
    sel.value = 'itm-a';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith('itm-a');
  });

  it('selecting "- none -" invokes onChange(null)', () => {
    const map = items({ 'itm-a': { name: 'Apple' } });
    const onChange = vi.fn();
    render(h(ItemPicker, { items: map, value: 'itm-a', onChange }), host);
    const sel = host.querySelector('select');
    sel.value = '';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('shows "(missing: <id>)" for a value that does not exist in items', () => {
    const map = items({ 'itm-a': { name: 'Apple' } });
    render(h(ItemPicker, { items: map, value: 'itm-ghost', onChange: () => {} }), host);
    expect(host.textContent).toMatch(/missing.*itm-ghost/);
  });
});
