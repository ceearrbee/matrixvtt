
import { h } from 'preact';
import {
  charactersSignal, npcsSignal, tokensSignal, settingsSignal,
} from '../state/signals.js';
import { Avatar } from './Avatar.jsx';
import { KnockRequests } from './KnockRequests.jsx';
import { EmptyState } from './EmptyState.jsx';
import { COND_ICONS } from '../utils/conditions.js';
import { TABS } from '../utils/constants.js';

function _findTokenFor(ui, entityId) {
  if (!entityId || !ui?.state?.tokens) return null;
  return Array.from(ui.state.tokens.values()).find(
    (t) => t?.sheet_id === entityId,
  ) || null;
}

function HpBar({ current, max }) {
  const cur = Number(current ?? 0);
  const m = Number(max ?? 0);
  const pct = m > 0 ? Math.max(0, Math.min(100, (cur / m) * 100)) : 0;
  let color = 'var(--color-text-success)';
  if (pct < 50) color = 'var(--color-text-warning)';
  if (pct < 25) color = 'var(--color-text-danger)';
  return h('div', { class: 'party-roster__hpbar' },
    h('div', { class: 'party-roster__hpbar-fill', style: `width:${pct}%;background:${color};` }),
  );
}

function RosterCard({ ui, entity, isNPC = false }) {
  const token = _findTokenFor(ui, entity.id);
  const name = entity.name || (isNPC ? 'Unnamed NPC' : 'Unnamed character');
  const subtitleParts = [];
  if (entity.race) subtitleParts.push(entity.race);
  if (entity.class_name) {
    subtitleParts.push(entity.level ? `${entity.class_name} ${entity.level}` : entity.class_name);
  } else if (entity.class) {
    subtitleParts.push(entity.class);
  } else if (isNPC && entity.cr != null) {
    subtitleParts.push(`CR ${entity.cr}`);
  }
  const subtitle = subtitleParts.join(' · ');
  const hpCur = entity.hp_current ?? token?.hp_current;
  const hpMax = entity.hp_max ?? token?.hp_max;
  const ac = entity.ac ?? token?.ac;
  const speed = entity.speed ?? token?.speed;
  const init = entity.initiative_bonus ?? entity.init_mod;
  const conditions = token?.conditions || [];

  const onPick = () => {
    if (isNPC) {
      ui.selectNPCById?.(entity.id);
      ui.switchTab?.(TABS.NPC);
    } else {
      ui.selectCharacterById?.(entity.id);
      ui.switchTab?.(TABS.SHEET);
    }
  };

  return h('button', {
    type: 'button',
    class: `party-roster__card${isNPC ? ' party-roster__card--npc' : ''}`,
    onClick: onPick,
    'aria-label': `Open ${name}`,
  }, [
    h('div', { class: 'party-roster__head' }, [
      h(Avatar, {
        imageUrl: entity.image_url || token?.image_url,
        name,
        color: token?.color,
        size: 40,
      }),
      h('div', { class: 'party-roster__meta' }, [
        h('div', { class: 'party-roster__name' }, name),
        subtitle && h('div', { class: 'party-roster__subtitle' }, subtitle),
      ]),
    ]),
    hpMax != null && h('div', { class: 'party-roster__hp' }, [
      h('div', { class: 'party-roster__hp-row' }, [
        h('span', { class: 'party-roster__hp-label' }, 'HP'),
        h('span', { class: 'party-roster__hp-value' },
          `${hpCur ?? '?'} / ${hpMax}`),
      ]),
      h(HpBar, { current: hpCur, max: hpMax }),
    ]),
    h('div', { class: 'party-roster__stats' }, [
      ac != null && h('div', { class: 'stat-box' }, [
        h('div', { class: 'stat-box__label' }, 'AC'),
        h('div', { class: 'stat-box__value' }, String(ac)),
      ]),
      speed != null && h('div', { class: 'stat-box' }, [
        h('div', { class: 'stat-box__label' }, 'Speed'),
        h('div', { class: 'stat-box__value' }, String(speed)),
      ]),
      init != null && h('div', { class: 'stat-box' }, [
        h('div', { class: 'stat-box__label' }, 'Init'),
        h('div', { class: 'stat-box__value' },
          init >= 0 ? `+${init}` : String(init)),
      ]),
    ]),
    conditions.length > 0 && h('div', { class: 'party-roster__conditions' },
      conditions.slice(0, 5).map((c) => h('span', {
        key: c,
        class: 'party-roster__cond',
        title: c,
        'aria-label': c,
      }, COND_ICONS[c] || c.charAt(0))),
    ),
  ]);
}

export function PartyRoster({ ui }) {
  charactersSignal.value;
  npcsSignal.value;
  tokensSignal.value;
  settingsSignal.value;

  const characters = ui?.state?.characters
    ? [...ui.state.characters.values()]
    : [];
  const myUserId = ui?.widgetManager?.userId ?? ui?.state?.widgetManager?.userId ?? null;
  // Only the creatures THIS user controls (summons / familiars /
  // henchmen a GM assigned to them). The GM's monster roster is not
  // dumped here - it lives in the NPCs tab.
  const companions = ui?.state?.npcs
    ? [...ui.state.npcs.values()].filter((n) => n.controlled_by && n.controlled_by === myUserId)
    : [];

  if (characters.length === 0 && companions.length === 0) {
    return h('aside', {
      class: 'party-roster',
      role: 'complementary',
      'aria-label': 'Party roster',
    }, [h(KnockRequests, { ui }), h(EmptyState, {
      glyph: '🎭',
      title: 'No characters yet',
      body: 'Add a character to populate the roster. Creatures a GM hands you (summons, familiars, henchmen) appear here too.',
      cta: ui?.createCharacter
        ? { label: 'Create a character', onClick: () => ui.createCharacter() }
        : null,
    })]);
  }

  return h('aside', {
    class: 'party-roster',
    role: 'complementary',
    'aria-label': 'Party roster',
  }, [
    h(KnockRequests, { ui }),
    characters.length > 0 && h('section', { class: 'party-roster__section' }, [
      h('div', { class: 'party-roster__label' }, 'Party'),
      h('div', { class: 'party-roster__list' },
        characters.map((c) => h(RosterCard, {
          key: c.id, ui, entity: c, isNPC: false,
        })),
      ),
    ]),
    companions.length > 0 && h('section', { class: 'party-roster__section' }, [
      h('div', { class: 'party-roster__label' }, 'Companions'),
      h('div', { class: 'party-roster__list party-roster__list--npc' },
        companions.map((n) => h(RosterCard, {
          key: n.id, ui, entity: n, isNPC: true,
        })),
      ),
    ]),
  ]);
}
