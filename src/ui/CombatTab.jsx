/**
 * CombatTab.jsx - active-turn panel inside the right-side tab strip.
 *
 * Shows the current combatant, action economy pips, and the unified
 * play-actions surface (attacks / spells / items / common actions)
 * rendered via the `play_actions` section so the same UX appears on
 * the character sheet too.
 */

import { h } from 'preact';
import { signal } from '@preact/signals';

import { initiativeSignal, tokensSignal } from '../state/signals.js';
import { EmptyState } from './EmptyState.jsx';
import { ENTITY_TYPES } from '../utils/constants.js';
import { _kindsForTest as SHEET_KINDS } from './characterSheetSections.js';
import { pairedSlotSection } from './attribute-pairing.js';
import { DynamicAttributes } from './DynamicAttributes.jsx';
import { opposedTargetFor, resolveOpposedRoll } from './combat/opposed-roll.js';
import { InitiativeEntry } from './InitiativeEntry.jsx';
import { getHPPercentage } from '../utils/ui-helpers.js';

const expandedCombatTokenIdSignal = signal(null);

const DEFAULT_ECONOMY = [
  { key: 'action_used', label: 'A', title: 'Action' },
  { key: 'bonus_action_used', label: 'B', title: 'Bonus Action' },
  { key: 'reaction_used', label: 'R', title: 'Reaction' },
];

function CurrentCard({ entry, token, round, myTurn }) {
  const hpText = entry?.hp_max != null ? `HP ${entry.hp_current ?? '?'}/${entry.hp_max}` : '';
  const acText = token?.ac != null ? `AC ${token.ac}` : '';
  return h('div', { class: 'combat-current-card-wrapper' }, [
    myTurn
      ? h('div', { class: 'your-turn-banner', style: 'margin-bottom:var(--space-md)' }, 'Your turn')
      : h('div', { style: 'font-size:var(--font-size-xs);color:var(--color-text-secondary);margin-bottom:var(--space-sm)' }, [
          'Current: ',
          h('strong', null, entry?.name || '-'),
        ]),
    h('div', { class: 'combat-current-card' }, [
      h('div', { class: 'combat-current-card__name' }, entry?.name || '-'),
      h('div', { class: 'combat-current-card__stats' }, [
        h('span', null, hpText),
        acText && h('span', null, acText),
        h('span', null, `Round ${round || 1}`),
      ]),
    ]),
  ]);
}

const PLAY_ACTIONS_CONFIG = {
  kind: 'play_actions',
  label: 'Actions',
  groups: [
    { label: 'Attacks', source: 'character_actions', filter: 'attack' },
    { label: 'Spells',  source: 'spell_ids' },
    { label: 'Items',   source: 'inventory_consumables' },
    { label: 'Common',  source: 'ruleset_common_actions' },
  ],
};

export function CombatTab({ ui }) {
  initiativeSignal.value; tokensSignal.value;
  const { order, current_index, active, round } = ui.state.initiative;

  const expandedTokenId = expandedCombatTokenIdSignal.value;
  const onExpand = (tokenId) => {
    expandedCombatTokenIdSignal.value = expandedCombatTokenIdSignal.value === tokenId ? null : tokenId;
  };



  const isGM = typeof ui?.state?.isGM === 'function' ? ui.state.isGM() : false;

  if (!active || !order?.length) {
    return h(EmptyState, {
      title: 'Combat is not active.',
      body: 'Start an encounter to track initiative and turns.',
      cta: isGM && ui?.rollInitiative ? { label: 'Roll Initiative', onClick: () => ui.rollInitiative() } : null,
    });
  }

  const myTurn = ui._isMyCombatTurn();
  const canControl = isGM || myTurn;
  const entry = order[current_index];
  const token = entry ? ui.state.tokens.get(entry.token_id) : null;
  // Resolve the combatant's authored data - characters for PCs, NPC
  // records for NPCs. For NPCs we synthesize a character-shaped object
  // when only the inline token.actions are present (legacy paste-in
  // stat blocks didn't always create a backing NPC).
  const sheet = token?.sheet_id ? (ui.state.characters.get(token.sheet_id) || ui.state.npcs.get(token.sheet_id)) : null;
  const combatantCharacter = sheet ?? (token?.type === ENTITY_TYPES.NPC && token.actions
    ? { id: token.id, name: token.name, actions: token.actions }
    : null);
  const ruleset = ui.state.settings.systemConfig;
  const economy = ruleset?.action_economy ?? DEFAULT_ECONOMY;

  const turnOrderSection = h('div', { class: 'combat-tab__order' }, [
    h('div', { class: 'combat-section' }, 'Turn order'),
    h('div', { class: 'initiative-entries', role: 'list' },
      order.map((e, index) => h(InitiativeEntry, {
        key: e.token_id,
        ui,
        entry: e,
        index,
        current_index,
        isGM,
        myTurn: myTurn && index === current_index,
        actionEconomy: economy,
        getHPPercentage,
        isExpanded: expandedTokenId === e.token_id,
        onExpand,
      }))
    ),
  ]);

  if (!canControl) {
    return h('div', {
      class: 'combat-tab-wrapper combat-tab-wrapper--view-only',
      style: 'padding:var(--space-md)',
    }, [
      h(CurrentCard, { entry, token, round, myTurn }),
      turnOrderSection,
    ]);
  }

  const pairedSlots = pairedSlotSection(ruleset);

  return h('div', { class: 'combat-tab-wrapper', style: 'padding:var(--space-md)' }, [
    h(CurrentCard, { entry, token, round, myTurn }),
    turnOrderSection,
    economy.length > 0 && h('div', { class: 'combat-section' }, 'Action economy'),
    economy.length > 0 && h('div', { class: 'combat-economy-row' },
      economy.map(ae => h('button', {
        key: ae.key,
        class: `combat-economy-pip${entry[ae.key] ? ' combat-economy-pip--used' : ''}`,
        'aria-pressed': String(!!entry[ae.key]),
        title: `Toggle ${ae.title}`,
        'aria-label': ae.title,
        onClick: () => ui.toggleCombatAction(ae.key),
      }, `${entry[ae.key] ? '● ' : '○ '}${ae.title}`))),
    // Slot-paired systems (Risus): the named pools ARE the combat
    // actions, so the combatant's clichés render as roll buttons.
    // With an enemy token selected, the roll resolves opposed: the
    // defender answers with their best pool and the loser ticks a die.
    pairedSlots && sheet && h('div', null, [
      h('div', { class: 'combat-section' }, pairedSlots.label || 'Attributes'),
      h(DynamicAttributes, {
        ui, attributes: sheet.attributes || {}, character: sheet,
        onRoll: (label, value) => {
          const targetTokenId = opposedTargetFor(ui);
          if (!targetTokenId) return ui.rollAttributeCheck?.(label, value);
          return resolveOpposedRoll(ui, {
            attackerName: entry?.name ?? sheet.name,
            attackerLabel: label,
            attackerDice: value,
            attackerTokenId: entry?.token_id,
            targetTokenId,
          });
        },
      }),
    ]),
    combatantCharacter && SHEET_KINDS.play_actions({
      ui, character: combatantCharacter, config: PLAY_ACTIONS_CONFIG,
    }),
    h('button', {
      class: 'btn-primary',
      style: 'width:100%;margin-top:var(--space-md)',
      'data-action': 'end-turn',
      'aria-label': 'End turn',
      onClick: () => ui.nextTurn(),
    }, 'End Turn'),
  ]);
}
