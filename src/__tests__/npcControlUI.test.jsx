/**
 * The NPC sheet exposes a GM-only "Controlled by" picker so the GM can
 * hand a creature (summon / familiar / henchman) to a player, who then
 * sees it in their Party roster. Players never see the picker.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { NPCSheet } from '../ui/NPCSheet.jsx';

afterEach(() => cleanup());

function mkUi({ isGM = true, controlledBy = null } = {}) {
  const npc = { id: 'npc-fam', type: 'npc', name: 'Pseudodragon', cr: '1/4', controlled_by: controlledBy };
  return {
    state: {
      isGM: () => isGM,
      npcs: new Map([['npc-fam', npc]]),
      selectedNPCId: 'npc-fam',
      settings: { systemConfig: {} },
      roomMembers: [
        { userId: '@ari:s', displayname: 'Ari' },
        { userId: '@bo:s', displayname: 'Bo' },
      ],
    },
    widgetManager: { userId: '@gm:s' },
    assignNPCController: vi.fn(),
    releaseNPCController: vi.fn(),
    showEntityForm: vi.fn(),
    placeSheetOnMap: vi.fn(),
    clearSelectedNPC: vi.fn(),
  };
}

describe('NPC sheet control picker', () => {
  it('renders a GM-only picker listing room members', () => {
    const { container } = render(h(NPCSheet, { ui: mkUi() }));
    const select = container.querySelector('[data-npc-control="npc-fam"]');
    expect(select).not.toBeNull();
    const optionValues = Array.from(select.querySelectorAll('option')).map((o) => o.value);
    expect(optionValues).toContain('@ari:s');
    expect(optionValues).toContain('@bo:s');
    expect(optionValues).toContain(''); // unassigned / GM-only
  });

  it('assigns control when the GM picks a player', () => {
    const ui = mkUi();
    const { container } = render(h(NPCSheet, { ui }));
    const select = container.querySelector('[data-npc-control="npc-fam"]');
    fireEvent.change(select, { target: { value: '@bo:s' } });
    expect(ui.assignNPCController).toHaveBeenCalledWith('npc-fam', '@bo:s');
  });

  it('releases control when the GM picks the unassigned option', () => {
    const ui = mkUi({ controlledBy: '@bo:s' });
    const { container } = render(h(NPCSheet, { ui }));
    const select = container.querySelector('[data-npc-control="npc-fam"]');
    fireEvent.change(select, { target: { value: '' } });
    expect(ui.releaseNPCController).toHaveBeenCalledWith('npc-fam');
  });

  it('hides the picker from non-GM players', () => {
    const { container } = render(h(NPCSheet, { ui: mkUi({ isGM: false }) }));
    expect(container.querySelector('[data-npc-control]')).toBeNull();
  });
});
