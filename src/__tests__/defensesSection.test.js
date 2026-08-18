/**
 * `defenses` section kind renders an NPC's damage resistances /
 * immunities / vulnerabilities and condition immunities. Hidden in
 * full when no field is set so a stat block without defenses doesn't
 * leave a stray "Defenses" header.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderSectionList } from '../ui/characterSheetSections.js';

function mkUi() {
  return {
    state: {
      settings: { systemConfig: {} },
      canEditEntity: () => false,
      items: new Map(),
      widgetManager: { userId: '@me:s' },
    },
    widgetManager: { userId: '@me:s' },
    _toast: vi.fn(),
  };
}

function renderToHtml(ui, entity, sections) {
  // Render the dispatched VNodes through preact-render-to-string-style
  // serialization. We just walk the tree for textContent here.
  const nodes = renderSectionList(ui, entity, sections);
  return nodes.map(serialize).join('');
}

function serialize(vnode) {
  if (vnode == null || typeof vnode === 'boolean') return '';
  if (typeof vnode === 'string' || typeof vnode === 'number') return String(vnode);
  if (Array.isArray(vnode)) return vnode.map(serialize).join('');
  const children = vnode.props?.children;
  if (children) return Array.isArray(children) ? children.map(serialize).join('') : serialize(children);
  return '';
}

describe('defenses section kind', () => {
  it('renders all four defense categories that are present', () => {
    const npc = {
      damage_resistances: 'cold; bludgeoning from non-magical weapons',
      damage_immunities: 'fire',
      damage_vulnerabilities: 'thunder',
      condition_immunities: 'frightened, paralyzed',
    };
    const html = renderToHtml(mkUi(), npc, [{ kind: 'defenses' }]);
    expect(html).toMatch(/Defenses/);
    expect(html).toMatch(/Resistances/);
    expect(html).toMatch(/cold/);
    expect(html).toMatch(/Immunities/);
    expect(html).toMatch(/fire/);
    expect(html).toMatch(/Vulnerabilities/);
    expect(html).toMatch(/thunder/);
    expect(html).toMatch(/Conditions Immune/);
    expect(html).toMatch(/frightened/);
  });

  it('hides the section entirely when no defense fields are set', () => {
    const html = renderToHtml(mkUi(), {}, [{ kind: 'defenses' }]);
    expect(html).toBe('');
  });

  it('skips empty individual fields but renders the section if any field is present', () => {
    const npc = { damage_immunities: 'fire' };
    const html = renderToHtml(mkUi(), npc, [{ kind: 'defenses' }]);
    expect(html).toMatch(/Defenses/);
    expect(html).toMatch(/fire/);
    expect(html).not.toMatch(/Resistances/);
  });
});
