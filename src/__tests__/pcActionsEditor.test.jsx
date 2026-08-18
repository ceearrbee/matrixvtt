/**
 * PCs can now author their own action list - the same authoring UI
 * that NPCs have been using all along, with the NPC-only "Hidden from
 * players" checkbox suppressed.
 *
 * The data shape (`character.actions = [{name, description,
 * attack_bonus, damage, damage_type}]`) is what the play_actions
 * "Attacks" group renders, so authoring here lights up the unified
 * play surface for PCs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { h } from 'preact';
import { NPCActions } from '../ui/entity-form/NPCFields.jsx';

beforeEach(() => { document.body.innerHTML = ''; });

describe('NPCActions component renders for PCs', () => {
  it('PC entity shows the Actions section + Add button', () => {
    render(h(NPCActions, { entity: { id: 'c1' }, isPC: true, isEdit: true }));
    expect(screen.getByText('Actions')).toBeTruthy();
    expect(screen.getByRole('button', { name: /add action/i })).toBeTruthy();
  });

  it('PC entity does NOT show "Hidden from players" checkbox', () => {
    render(h(NPCActions, { entity: { id: 'c1' }, isPC: true, isEdit: true }));
    expect(screen.queryByLabelText(/hidden from players/i)).toBeNull();
  });

  it('NPC entity still shows "Hidden from players" checkbox', () => {
    render(h(NPCActions, { entity: { id: 'n1', is_hidden: false }, isPC: false, isEdit: true }));
    expect(screen.queryByLabelText(/hidden from players/i)).toBeTruthy();
  });

  it('seeds rows from entity.actions[] for PCs', () => {
    render(h(NPCActions, {
      entity: { id: 'c1', actions: [
        { name: 'Shortsword',  attack_bonus: 5, damage: '1d6+3' },
        { name: 'Sneak Attack' },
      ]},
      isPC: true, isEdit: true,
    }));
    const names = document.querySelectorAll('.action-name');
    expect(names.length).toBe(2);
    expect(names[0].value).toBe('Shortsword');
    expect(names[1].value).toBe('Sneak Attack');
  });

  it('Add appends an empty row', () => {
    render(h(NPCActions, { entity: { id: 'c1', actions: [{ name: 'Bite' }] }, isPC: true, isEdit: true }));
    expect(document.querySelectorAll('.action-name').length).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: /add action/i }));
    expect(document.querySelectorAll('.action-name').length).toBe(2);
  });

  it('Remove drops the targeted row', () => {
    render(h(NPCActions, {
      entity: { id: 'c1', actions: [{ name: 'Keep' }, { name: 'Drop' }, { name: 'Keep too' }] },
      isPC: true, isEdit: true,
    }));
    const removes = screen.getAllByRole('button', { name: /remove action/i });
    expect(removes).toHaveLength(3);
    fireEvent.click(removes[1]);
    const names = Array.from(document.querySelectorAll('.action-name')).map((n) => n.value);
    expect(names).toEqual(['Keep', 'Keep too']);
  });
});

describe('createCharacter / updateCharacter parse actions[]', () => {
  it('updateCharacter pulls actions from the form and writes character.actions', async () => {
    const { updateCharacter } = await import('../ui/entity/forms.js');

    // Build a fake modal DOM with one action row
    const modal = document.createElement('div');
    modal.innerHTML = `
      <input id="entity-name" value="Aria" />
      <input id="entity-hp-max" value="10" />
      <div id="entity-actions-list">
        <fieldset data-action-row="0">
          <input class="action-name" value="Shortsword" />
          <input class="action-desc" value="Finesse, light." />
          <input class="action-attack" value="5" />
          <input class="action-damage" value="1d6+3" />
          <input class="action-damage-type" value="piercing" />
        </fieldset>
      </div>
    `;
    document.body.appendChild(modal);

    const existing = { id: 'c1', name: 'Aria', type: 'pc', hp_max: 10, actions: [] };
    let savedContent;
    const ui = {
      state: {
        characters: new Map([[existing.id, existing]]),
        sendRoomEvent: vi.fn().mockImplementation((type, content) => {
          savedContent = content;
          return Promise.resolve();
        }),
        updateCharacter: vi.fn().mockResolvedValue(true),
      },
      _collectAttributeValues: () => ({}),
      _collectSpellSlots: () => ({}),
      widgetManager: { userId: '@me:hs' },
    };

    await updateCharacter(ui, modal, 'c1');
    // Either via sendRoomEvent or updateCharacter - the action data
    // should land in the saved character record.
    const captured = savedContent ?? ui.state.updateCharacter.mock.calls[0]?.[1];
    expect(captured?.actions).toBeTruthy();
    expect(captured.actions[0]).toMatchObject({
      name: 'Shortsword',
      attack_bonus: 5,
      damage: '1d6+3',
      damage_type: 'piercing',
    });
  });
});
