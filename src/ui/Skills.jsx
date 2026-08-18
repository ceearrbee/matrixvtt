/**
 * Skills.jsx - skills tab. Renders ruleset-defined skills (D&D-style with
 * attribute modifiers + proficiency dots) or a generic override-only list.
 */

import { h } from 'preact';
import { EditIcon, TrashIcon } from './icons/index.jsx';
import { charactersSignal } from '../state/signals.js';
import { selectedCharacterIdSignal, selectedTokenSignal } from '../state/ui-signals.js';
import { computeDerived } from '../engine/computeDerived.js';
import { EmptyState } from './EmptyState.jsx';
import { calcSkillBonus as calcBonus } from './skill-bonus.js';

function SkillFullRow({ ui, skillDef, bonus, attrLabel, canEdit, character }) {
  const isProf = (character.skill_proficiencies ?? []).includes(skillDef.key);
  const isExpert = (character.skill_expertise ?? []).includes(skillDef.key);
  const dotState = isExpert ? 'expertise' : isProf ? 'proficient' : 'none';

  const onRoll = (e) => {
    if (e.target.closest('button')) return;
    ui.rollSkillCheck(skillDef.label, bonus);
  };
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRoll(e); }
  };

  return h('div', {
    class: 'skill-full-row', role: 'button', tabindex: 0,
    'aria-label': `${skillDef.label} (${attrLabel}): ${bonus >= 0 ? '+' : ''}${bonus}. Press Enter to roll.`,
    onClick: onRoll, onKeyDown: onKey,
  }, [
    canEdit
      ? h('button', {
          class: `skill-full-row__prof-btn skill-full-row__prof-btn--${dotState}`,
          'aria-label': `Proficiency: ${dotState}. Click to cycle.`,
          title: 'none → proficient → expertise',
          onClick: (e) => { e.stopPropagation(); ui.cycleSkillProficiency(skillDef.key); },
        })
      : h('span', { class: `skill-full-row__prof-dot skill-full-row__prof-dot--${dotState}`, 'aria-label': dotState }),
    h('span', { class: 'skill-full-row__name' }, skillDef.label),
    h('span', { class: 'skill-full-row__attr' }, attrLabel),
    h('span', { class: 'skill-full-row__bonus' }, `${bonus >= 0 ? '+' : ''}${bonus}`),
    h('span', { class: 'skill-full-row__roll-hint', 'aria-hidden': 'true' }, '🎲'),
  ]);
}

function GenericSkillRow({ ui, skillKey, bonus, canEdit }) {
  const onRoll = (e) => {
    if (e.target.closest('button')) return;
    ui.rollSkillCheck(skillKey, bonus);
  };
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRoll(e); }
  };
  return h('div', {
    class: 'skill-full-row', role: 'button', tabindex: 0,
    'aria-label': `${skillKey}: ${bonus >= 0 ? '+' : ''}${bonus}. Press Enter to roll.`,
    title: `Click to roll ${skillKey} check`,
    onClick: onRoll, onKeyDown: onKey,
  }, [
    h('span', { class: 'skill-full-row__name' }, skillKey.replace(/_/g, ' ')),
    h('span', { class: 'skill-full-row__attr' }),
    h('span', { class: 'skill-full-row__bonus' }, `${bonus >= 0 ? '+' : ''}${bonus}`),
    canEdit && h('button', {
      class: 'dbt dbt--compact',
      'aria-label': `Edit ${skillKey}`, title: 'Edit skill',
      onClick: (e) => { e.stopPropagation(); ui.showAddSkillOverrideForm(skillKey); },
    }, h(EditIcon, {})),
    canEdit && h('button', {
      class: 'dbt dbt--compact',
      'aria-label': `Delete ${skillKey}`, title: 'Delete skill',
      style: 'color: var(--color-text-danger);',
      onClick: (e) => { e.stopPropagation(); ui.deleteSkillOverride(skillKey); },
    }, h(TrashIcon, {})),
    h('span', { class: 'skill-full-row__roll-hint', 'aria-hidden': 'true' }, '🎲'),
  ]);
}

export function Skills({ ui }) {
  // Also subscribe to selection signals - getCurrentCharacter reads them.
  charactersSignal.value;
  selectedCharacterIdSignal.value; selectedTokenSignal.value;
  const character = ui.state.getCurrentCharacter();
  if (!character) {
    return h('div', { class: 'empty-state' }, 'No character selected');
  }

  const ruleset = ui.state.settings.systemConfig;
  const canEdit = ui.state.canEditEntity(character);
  const rulesetSkills = ruleset?.skills;

  if (!rulesetSkills?.length) {
    const entries = Object.entries(character.skills ?? {});
    return h('div', { class: 'skills-tab-wrapper' }, [
      h('div', { class: 'tab-toolbar' }, [
        h('span', { class: 'tab-toolbar__title' }, 'Skills'),
        canEdit && h('button', {
          class: 'dbt dbt--sm btn-primary',
          'aria-label': 'Add new custom skill', title: 'Add skill',
          onClick: () => ui.showAddSkillOverrideForm(),
        }, '+ Add Skill'),
      ]),
      entries.length === 0
        ? h(EmptyState, {
            message: 'No skills defined.',
            cta: canEdit ? { label: '+ Add Skill', onClick: () => ui.showAddSkillOverrideForm() } : undefined,
          })
        : h('div', { class: 'skills-tab-list', role: 'list' },
            entries.map(([key, bonus]) => h(GenericSkillRow, { key, ui, skillKey: key, bonus, canEdit }))),
    ]);
  }

  const profBonus =
    computeDerived(ruleset, 'proficiency_bonus', { level: character.level ?? 1 }) ?? 0;
  const attrLabels = {};
  (ruleset?.attributes || []).forEach(a => { attrLabels[a.key] = a.label; });

  return h('div', { class: 'skills-tab-wrapper' }, [
    h('div', { class: 'tab-toolbar' }, [
      h('span', { class: 'tab-toolbar__title' }, 'Skills'),
      canEdit && h('span', { class: 'tab-toolbar__hint' }, 'Click ○ to toggle proficiency'),
    ]),
    h('div', { class: 'skills-tab-list', role: 'list' },
      rulesetSkills.map(skillDef => {
        const bonus = calcBonus(ui, character, skillDef, profBonus);
        const attrLabel = attrLabels[skillDef.attribute] || skillDef.attribute.toUpperCase().slice(0, 3);
        return h(SkillFullRow, {
          key: skillDef.key, ui, skillDef, bonus, attrLabel, canEdit, character,
        });
      })),
  ]);
}
