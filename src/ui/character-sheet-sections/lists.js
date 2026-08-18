/**
 * List- and action-oriented section primitives - the larger sheet
 * surfaces (skill list, currency, inventory summary, spell book,
 * play-actions surface, action cards). Dispatcher lives in
 * `../characterSheetSections.js`.
 */

import { h, Fragment } from 'preact';
import { renderMarkdown } from '../../utils/renderMarkdown.js';
import { calcSkillBonus, proficiencyBonusFor } from '../skill-bonus.js';
import { resolveGroup } from '../play-actions/sources.js';

/**
 * `skill_list` - reads `ruleset.skills[]` for the canonical list,
 * computes each bonus via `calcSkillBonus` (mirrors the Skills tab so
 * the same proficiency/expertise logic applies), renders one clickable
 * row per skill. Clicking rolls a skill check.
 */
export function SkillList({ ui, character, config }) {
  const ruleset = ui?.state?.settings?.systemConfig;
  const skills = Array.isArray(ruleset?.skills) ? ruleset.skills : [];
  if (skills.length === 0) {
    return h(Fragment, null, [
      h('div', { class: 'section-header' }, config?.label ?? 'Skills'),
      h('div', { class: 'narrative-list__empty' }, 'No skills declared by ruleset.'),
    ]);
  }
  const profBonus = proficiencyBonusFor(ruleset, character);
  const attrLabels = {};
  (ruleset?.attributes || []).forEach((a) => { attrLabels[a.key] = a.label; });

  const rows = skills.map((sd) => {
    const bonus = calcSkillBonus(ui, character, sd, profBonus);
    const attrLabel = attrLabels[sd.attribute] || (sd.attribute || '').toUpperCase().slice(0, 3);
    const isProf = (character?.skill_proficiencies ?? []).includes(sd.key);
    const isExpert = (character?.skill_expertise ?? []).includes(sd.key);
    const dotState = isExpert ? 'expertise' : isProf ? 'proficient' : 'none';
    const signed = `${bonus >= 0 ? '+' : ''}${bonus}`;
    return h('div', {
      key: sd.key,
      class: 'narrative-list__row',
      role: 'button',
      tabindex: 0,
      'data-skill-key': sd.key,
      'aria-label': `${sd.label} (${attrLabel}): ${signed}. Press Enter to roll.`,
      onClick: () => ui.rollSkillCheck?.(sd.label, bonus),
      onKeyDown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          ui.rollSkillCheck?.(sd.label, bonus);
        }
      },
    }, [
      h('span', {
        class: `skill-full-row__prof-dot skill-full-row__prof-dot--${dotState}`,
        'aria-label': `Proficiency: ${dotState}`,
      }),
      h('span', { class: 'narrative-list__text' }, sd.label),
      h('span', { class: 'narrative-list__attr' }, attrLabel),
      h('span', { class: 'narrative-list__num' }, signed),
    ]);
  });
  return h('section', { class: 'narrative-section', 'aria-label': config?.label ?? 'Skills' }, [
    h('div', { class: 'section-header' }, config?.label ?? 'Skills'),
    h('div', { class: 'narrative-list' }, rows),
  ]);
}

/**
 * `currency` - one editable input per ruleset-declared denomination
 * (`ruleset.currency.denominations[]`).
 */
export function Currency({ ui, character, config }) {
  const denoms = ui?.state?.settings?.systemConfig?.currency?.denominations;
  const list = Array.isArray(denoms) ? denoms : [];
  const canEdit = ui?.state?.canEditEntity?.(character) ?? true;
  const current = (character?.currency && typeof character.currency === 'object') ? character.currency : {};

  if (list.length === 0) {
    if (!canEdit) return null;
    return h(Fragment, null, [
      h('div', { class: 'section-header' }, config?.label ?? 'Currency'),
      h('div', { class: 'narrative-list__empty' }, 'No denominations declared by ruleset.'),
    ]);
  }

  const onBlur = (denom) => (e) => {
    const raw = e.target.value;
    const next = Number.isFinite(parseInt(raw, 10)) ? Math.max(0, parseInt(raw, 10)) : 0;
    const prior = Number(current[denom] ?? 0);
    if (next === prior) return;
    ui?.patchEntity?.(character.id, {
      currency: { ...current, [denom]: next },
    });
  };

  return h('section', {
    class: 'narrative-section',
    role: 'group',
    'aria-label': config?.label ?? 'Currency',
  }, [
    h('div', { class: 'section-header' }, config?.label ?? 'Currency'),
    h('div', { class: 'narrative-slots' }, list.map((d) => h('div', {
      key: d.key,
      class: 'narrative-slots__row',
    }, [
      h('label', {
        class: 'narrative-slots__label',
        for: `currency-${d.key}`,
      }, d.label),
      h('input', {
        type: 'number',
        id: `currency-${d.key}`,
        class: 'form-input narrative-slots__input',
        min: 0,
        step: 1,
        readOnly: !canEdit,
        defaultValue: String(Number(current[d.key] ?? 0)),
        onBlur: onBlur(d.key),
        'aria-label': d.label,
      }),
    ]))),
  ]);
}

/**
 * `inventory_summary` - one row per item; click to preview, "Use"
 * button for consumables, qty badge when > 1. Reads
 * `character.inventory_ids[]` against the `items` collection.
 */
export function InventorySummary({ ui, character, config }) {
  const ids = Array.isArray(character?.inventory_ids) ? character.inventory_ids : [];
  const items = ui?.state?.items;
  const rows = ids
    .map((id) => items?.get?.(id))
    .filter(Boolean);
  const label = config?.label ?? 'Inventory';
  const canEdit = ui?.state?.canEditEntity?.(character) ?? true;

  if (rows.length === 0) {
    // Read-only viewers don't need the "Inventory is empty." banner - it's
    // visual noise on a sheet that already has plenty to read.
    if (!canEdit) return null;
    return h('section', { class: 'narrative-section', 'aria-label': label }, [
      h('div', { class: 'section-header' }, label),
      h('div', { class: 'narrative-list__empty' }, 'Inventory is empty.'),
    ]);
  }

  return h('section', { class: 'narrative-section', 'aria-label': label }, [
    h('div', { class: 'section-header' }, label),
    h('ul', { class: 'narrative-list' }, rows.map((item) => {
      const qty = Number(item.quantity ?? 1);
      const isConsumable = item.consumable === true || item.kind === 'consumable';
      return h('li', { key: item.id, class: 'narrative-list__row', 'data-item-id': item.id }, [
        h('span', {
          class: 'narrative-list__text clickable',
          role: 'button',
          tabindex: 0,
          'aria-label': `Open ${item.name}`,
          onClick: () => ui?.showItemPreview?.(item.id),
          onKeyDown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              ui?.showItemPreview?.(item.id);
            }
          },
        }, item.name),
        qty > 1 && h('span', { class: 'narrative-list__qty' }, `× ${qty}`),
        isConsumable && h('button', {
          type: 'button',
          class: 'dbt dbt--sm',
          'aria-label': `Use ${item.name}`,
          title: `Use ${item.name}`,
          onClick: () => ui?.consumeItem?.(item.id),
        }, 'Use'),
      ]);
    })),
  ]);
}

/**
 * `spell_book` - known spells grouped by level. Each spell is clickable
 * to open the spell preview; level headers show used/total ratio when
 * slots are declared.
 */
export function SpellBook({ ui, character, config }) {
  const ids = Array.isArray(character?.spell_ids) ? character.spell_ids : [];
  const spells = ui?.state?.spells;
  const known = ids.map((id) => spells?.get?.(id)).filter(Boolean);
  const label = config?.label ?? 'Spellbook';
  const canEdit = ui?.state?.canEditEntity?.(character) ?? true;
  if (known.length === 0) {
    if (!canEdit) return null;
    return h('section', { class: 'narrative-section', 'aria-label': label }, [
      h('div', { class: 'section-header' }, label),
      h('div', { class: 'narrative-list__empty' }, 'No spells prepared.'),
    ]);
  }

  // Group by level (cantrips first as level 0).
  const byLevel = new Map();
  for (const s of known) {
    const lvl = Number(s.level ?? 0);
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl).push(s);
  }
  const levels = Array.from(byLevel.keys()).sort((a, b) => a - b);
  const slots = (character?.spell_slots && typeof character.spell_slots === 'object') ? character.spell_slots : {};

  return h('section', { class: 'narrative-section', 'aria-label': label }, [
    h('div', { class: 'section-header' }, label),
    ...levels.map((lvl) => {
      const slot = slots[String(lvl)];
      const used = Number(slot?.used ?? 0);
      const total = Number(slot?.total ?? 0);
      const slotText = (lvl > 0 && total > 0) ? ` (${Math.max(0, total - used)}/${total})` : '';
      const levelHeader = lvl === 0 ? `Cantrips${slotText}` : `Level ${lvl}${slotText}`;
      return h('div', { key: `lvl-${lvl}`, class: 'narrative-group' }, [
        h('div', { class: 'section-header section-header--sub' }, levelHeader),
        h('ul', { class: 'narrative-list' }, byLevel.get(lvl).map((s) => h('li', {
          key: s.id, class: 'narrative-list__row',
        }, [
          h('span', {
            class: 'narrative-list__text clickable',
            role: 'button',
            tabindex: 0,
            'aria-label': `Open ${s.name}`,
            onClick: () => ui?.showSpellPreview?.(s.id),
            onKeyDown: (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                ui?.showSpellPreview?.(s.id);
              }
            },
          }, s.name),
        ]))),
      ]);
    }),
  ]);
}

/**
 * `play_actions` - unified turn-time action surface. Groups attacks,
 * spells, consumables, common-actions into one panel where each
 * button fires the existing handler (`_showAttackModal`, `castSpell`,
 * `consumeItem`, common-action announce).
 *
 * `source` is one of: 'character_actions' | 'spell_ids' |
 * 'inventory_consumables' | 'ruleset_common_actions'. See
 * src/ui/play-actions/sources.js.
 */
export function PlayActions({ ui, character, config }) {
  const groups = Array.isArray(config?.groups) ? config.groups : [];
  const state = ui?.state;
  const ruleset = state?.settings?.systemConfig;
  const ctx = { character, state, ruleset };

  const findTokenIdFor = (charId) => {
    if (!state?.tokens) return null;
    for (const [tid, t] of state.tokens.entries()) {
      if (t.sheet_id === charId) return tid;
    }
    return null;
  };

  // Pre-resolve each group so we know which to hide.
  const resolved = groups.map((g) => ({ config: g, items: resolveGroup(g, ctx) }));
  const nonEmpty = resolved.filter((r) => r.items.length > 0);
  if (nonEmpty.length === 0) {
    return h('section', { class: 'narrative-section', 'aria-label': config?.label ?? 'Actions' }, [
      h('div', { class: 'section-header' }, config?.label ?? 'Actions'),
      h('div', { class: 'narrative-list__empty' }, 'Nothing to do - no actions, spells, or consumables.'),
    ]);
  }

  const announceCommon = (label) => {
    const name = character?.name ?? 'Combatant';
    ui?.chat?.announceMessage?.(`${name} uses ${label}.`);
    ui?._log?.('⚔️', `${name} uses <b>${label}</b>.`);
  };

  const renderButton = (group, item, idx) => {
    switch (group.source) {
      case 'character_actions': {
        const tid = findTokenIdFor(character?.id);
        const subtitle = item.damage ? `${item.attack_bonus != null ? '+' + item.attack_bonus + ' · ' : ''}${item.damage}` : '';
        return h('button', {
          key: `act-${idx}`,
          type: 'button',
          class: 'dbt dbt--sm',
          'aria-label': `Use ${item.name}${subtitle ? ` (${subtitle})` : ''}`,
          title: subtitle,
          disabled: !tid,
          onClick: () => tid && ui?._showAttackModal?.(tid, idx),
        }, [
          h('span', { class: 'action-btn__name' }, item.name),
          subtitle && h('span', { class: 'action-btn__sub' }, subtitle),
        ]);
      }
      case 'spell_ids': {
        const subtitle = item.level === 0 ? 'cantrip' : `level ${item.level}${item.available ? '' : ' (no slots)'}`;
        return h('button', {
          key: `sp-${item.id}`,
          type: 'button',
          class: 'dbt dbt--sm',
          'aria-label': `Cast ${item.name} (${subtitle})`,
          title: subtitle,
          disabled: !item.available,
          onClick: () => ui?.castSpell?.(item.id, character?.id),
        }, [
          h('span', { class: 'action-btn__name' }, item.name),
          h('span', { class: 'action-btn__sub' }, subtitle),
        ]);
      }
      case 'inventory_consumables': {
        const qty = Number(item.quantity ?? 1);
        return h('button', {
          key: `it-${item.id}`,
          type: 'button',
          class: 'dbt dbt--sm',
          'aria-label': `Use ${item.name} (${qty} left)`,
          title: `× ${qty}`,
          onClick: () => ui?.consumeItem?.(item.id),
        }, [
          h('span', { class: 'action-btn__name' }, item.name),
          h('span', { class: 'action-btn__sub' }, `× ${qty}`),
        ]);
      }
      case 'ruleset_common_actions': {
        return h('button', {
          key: `co-${item.label}-${idx}`,
          type: 'button',
          class: 'dbt dbt--sm dbt--ghost',
          title: item.description || '',
          'aria-label': item.label,
          onClick: () => announceCommon(item.label),
        }, item.label);
      }
      default:
        return null;
    }
  };

  return h('section', { class: 'narrative-section', 'aria-label': config?.label ?? 'Actions' }, [
    h('div', { class: 'section-header' }, config?.label ?? 'Actions'),
    ...nonEmpty.map((g) => h('div', { key: g.config.label, class: 'narrative-group' }, [
      h('div', { class: 'section-header section-header--sub' }, g.config.label),
      h('div', {
        class: 'row-sm row--wrap',
        role: 'group',
        'aria-label': g.config.label,
      }, g.items.map((item, i) => renderButton(g.config, item, i))),
    ])),
  ]);
}

/**
 * Render a titled list of action cards from an arbitrary character field.
 * Default config matches the old `actions` kind (field='actions'); NPC
 * sheets use it with field='legendary_actions', 'lair_actions', 'traits'.
 */
export function ActionList({ ui, character, config }) {
  const field = config?.field ?? 'actions';
  const title = config?.title ?? 'Actions';
  const actions = Array.isArray(character[field]) ? character[field] : [];

  return h(Fragment, null, [
    h('div', { class: 'section-header' }, title),
    actions.length === 0
      ? h('div', { class: 'entity-subtitle entity-subtitle--none' },
          `No ${title.toLowerCase()} defined yet.`)
      : h('div', { class: 'actions-list' },
          actions.map((action, index) => renderActionCard(ui, character, action, index))),
  ]);
}

function renderActionCard(ui, character, action, index) {
  const roll = () => ui.rollNPCAction?.(character.id, index);
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); roll(); }
  };
  const titleText = action.attack_bonus != null
    ? `${action.name} (+${action.attack_bonus})`
    : action.name;

  // `action.damage` is GM-authored free text - render as a text child so
  // any HTML in the string is escaped. The description goes through
  // renderMarkdown (DOMPurified) and is the only HTML-bearing piece.
  const descHtml = renderMarkdown(action.description || '');
  return h('div', {
    key: index,
    class: 'action-card', role: 'button', tabindex: 0,
    onClick: roll,
    onKeyDown: onKey,
  }, [
    h('div', { class: 'action-card__title' }, titleText),
    h('div', { class: 'action-card__body' }, [
      action.damage ? h('b', { key: 'dmg' }, action.damage) : null,
      action.damage && descHtml ? ' · ' : null,
      descHtml
        ? h('span', { key: 'desc', dangerouslySetInnerHTML: { __html: descHtml } })
        : null,
    ]),
  ]);
}
