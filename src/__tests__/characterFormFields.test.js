/**
 * F3: the PC-creation form composes its body from
 * `ruleset.character_form.fields[]`. Each entry is `{kind, id, label, ...}`.
 * Unknown kinds silently skip (forward-compat, same rule as sheet sections).
 */

import { describe, it, expect } from 'vitest';
import { h } from 'preact';
import { render } from '@testing-library/preact';
import { renderFormFields } from '../ui/characterFormFields.js';

function mkUi(rulesetFields, extras = {}) {
  return {
    state: {
      settings: {
        systemConfig: {
          character_form: { fields: rulesetFields },
          attributes: [
            { key: 'str', label: 'STR', default: 10 },
            { key: 'dex', label: 'DEX', default: 10 },
          ],
        },
      },
    },
    ...extras,
  };
}

describe('renderFormFields', () => {
  it('empty or missing fields → empty list', () => {
    expect(renderFormFields(mkUi([]), {}, true)).toEqual([]);
    expect(renderFormFields(mkUi(undefined), {}, true)).toEqual([]);
  });

  it('unknown kinds produce no nodes', () => {
    const out = renderFormFields(mkUi([{ kind: 'martian_ray' }]), {}, true);
    expect(out).toHaveLength(0);
  });

  it('text field renders labeled input with default value', () => {
    const fields = [{ kind: 'text', id: 'species', label: 'Species', placeholder: 'Halfling' }];
    const tree = h('div', null, renderFormFields(mkUi(fields), { species: 'Elf' }, true));
    const { container } = render(tree);
    const input = container.querySelector('#entity-species');
    expect(input).toBeTruthy();
    expect(input.value).toBe('Elf');
    expect(input.placeholder).toBe('Halfling');
  });

  it('number field renders numeric input with min/default', () => {
    const fields = [{ kind: 'number', id: 'hp_max', label: 'HP Max', min: 1, default: 30 }];
    const tree = h('div', null, renderFormFields(mkUi(fields), {}, false /* new entity */));
    const { container } = render(tree);
    const input = container.querySelector('#entity-hp-max');
    expect(input.type).toBe('number');
    expect(Number(input.value)).toBe(30);
    expect(Number(input.min)).toBe(1);
  });

  it('row kind groups nested fields horizontally', () => {
    const fields = [{ kind: 'row', fields: [
      { kind: 'number', id: 'hp_current', label: 'HP', default: 10 },
      { kind: 'number', id: 'ac', label: 'AC', default: 10 },
    ]}];
    const tree = h('div', null, renderFormFields(mkUi(fields), {}, false));
    const { container } = render(tree);
    expect(container.querySelector('#entity-hp-current')).toBeTruthy();
    expect(container.querySelector('#entity-ac')).toBeTruthy();
    expect(container.querySelectorAll('.form-row').length).toBe(1);
  });

  it('textarea kind renders a resizable text area', () => {
    const fields = [{ kind: 'textarea', id: 'notes', label: 'Notes' }];
    const tree = h('div', null, renderFormFields(mkUi(fields), { notes: 'backstory' }, true));
    const { container } = render(tree);
    const ta = container.querySelector('#entity-notes');
    expect(ta.tagName).toBe('TEXTAREA');
    expect(ta.value).toBe('backstory');
  });

  it('attributes kind renders the attribute grid from ruleset attributes[]', () => {
    const fields = [{ kind: 'attributes' }];
    const tree = h('div', null, renderFormFields(mkUi(fields), { attributes: { str: 14 } }, true));
    const { container } = render(tree);
    expect(container.querySelector('#entity-attr-str')).toBeTruthy();
    expect(container.querySelector('#entity-attr-str').value).toBe('14');
    expect(container.querySelector('#entity-attr-dex')).toBeTruthy();
  });
});
