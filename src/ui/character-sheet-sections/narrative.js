/**
 * Interactive narrative-primitive section components.
 *
 * The dispatcher lives
 * in `../characterSheetSections.js`.
 */

import { h } from 'preact';
import { substituteTemplate, dispatchAnnounce } from '../narrative/announce.js';
import { isDisabled } from '../narrative/predicate.js';

/**
 * `tagged_list` - generic invokable list of strings.
 *
 *   { kind: 'tagged_list', field, label, editable?: boolean,
 *     placeholder?: string,
 *     row_action?: { label, announce, decrement_field?, modifier?,
 *                    disable_when_lte?: { field, value } } }
 *
 * Reads `character[field]` as `string[]`. Renders one row per entry,
 * with an optional per-row action button. When `editable: true` and
 * the viewer can edit, also renders an Add input + per-row Remove
 * button (Fari-style inline authoring on the sheet).
 */
export function TaggedList({ ui, character, config }) {
  const field = config?.field;
  const label = config?.label ?? '';
  const rows = Array.isArray(character?.[field]) ? character[field] : [];
  const action = config?.row_action;
  const actorName =
    ui?.widgetManager?.displayName ?? ui?.auth?.displayName ?? ui?.widgetManager?.userId ?? 'GM';

  const disabled = action ? isDisabled(character, action.disable_when_lte) : false;
  const canEdit = config?.editable === true && (ui?.state?.canEditEntity?.(character) ?? true);

  const invoke = (entry) => {
    if (!action || disabled) return;
    const message = substituteTemplate(action.announce ?? '', {
      actor: actorName,
      value: entry,
      modifier: action.modifier ?? 0,
    });
    // dispatchAnnounce because the update should happen even if the
    // chat-integrator is slow / pending - and we don't want to gate
    // the resource decrement on the announce promise resolving.
    dispatchAnnounce(ui, message);
    // Stage the modifier onto the character for the next roll to
    // consume. A row_action without a `modifier` produces no pending
    // entry (e.g. PbtA bond resolution).
    if (typeof action.modifier === 'number' && action.modifier !== 0) {
      const prior = Array.isArray(character.pending_modifiers) ? character.pending_modifiers : [];
      ui?.patchEntity?.(character.id, {
        pending_modifiers: [...prior, { value: action.modifier, source: entry }],
      });
    }
    if (action.decrement_field) {
      const cur = Number(character[action.decrement_field] ?? 0);
      ui?.patchEntity?.(character.id, { [action.decrement_field]: cur - 1 });
    } else if (action.increment_field) {
      const cur = Number(character[action.increment_field] ?? 0);
      const amount = Number(action.amount ?? 1);
      ui?.patchEntity?.(character.id, { [action.increment_field]: cur + amount });
    }
  };

  const removeRow = (idx) => {
    const next = rows.filter((_, i) => i !== idx);
    ui?.patchEntity?.(character.id, { [field]: next });
  };

  // Closure-captured uncontrolled-input ref: Preact assigns inputEl
  // on mount, and the click handler reads/clears it imperatively.
  let inputEl = null;
  const onAdd = () => {
    const raw = inputEl?.value ?? '';
    const value = raw.trim();
    if (!value) return;
    ui?.patchEntity?.(character.id, { [field]: [...rows, value] });
    if (inputEl) inputEl.value = '';
  };
  const onAddKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onAdd();
    }
  };

  const placeholder = config?.placeholder ?? `Add ${label}…`;
  const addInputId = `tagged-add-${field}`;

  // Refocus the input after Add for rapid entry. The mutation triggers
  // a re-render; we hold onto the same DOM node via ref, so focus
  // survives but we still call it explicitly to be safe under reconciliation.
  const addAndKeepFocus = () => {
    onAdd();
    inputEl?.focus?.();
  };

  return h('section', { class: 'narrative-section', 'aria-labelledby': `${addInputId}-h` }, [
    h('div', { class: 'section-header', id: `${addInputId}-h` }, label),
    rows.length === 0
      ? h('div', { class: 'narrative-list__empty' }, 'None')
      : h('ul', { class: 'narrative-list' },
          rows.map((entry, i) => h('li', {
            key: i,
            class: 'narrative-list__row',
          }, [
            h('span', { class: 'narrative-list__text' }, entry),
            action && h('button', {
              type: 'button',
              class: 'dbt dbt--sm',
              disabled,
              'aria-label': disabled
                ? `${action.label} ${entry} - unavailable`
                : `${action.label} ${entry}`,
              title: disabled ? 'Not enough resources to invoke' : undefined,
              onClick: () => invoke(entry),
            }, action.label),
            canEdit && h('button', {
              type: 'button',
              class: 'dbt dbt--sm dbt--ghost',
              'aria-label': `Remove ${entry}`,
              title: `Remove ${entry}`,
              onClick: () => removeRow(i),
            }, 'Remove'),
          ]))),
    canEdit && h('div', { class: 'narrative-add' }, [
      h('label', { class: 'sr-only', for: addInputId }, placeholder),
      h('input', {
        type: 'text',
        id: addInputId,
        class: 'form-input narrative-add__input',
        ref: (el) => { inputEl = el; },
        placeholder,
        onKeyDown: onAddKey,
        autocomplete: 'off',
      }),
      h('button', {
        type: 'button',
        class: 'dbt dbt--sm',
        onClick: addAndKeepFocus,
      }, 'Add'),
    ]),
  ]);
}

/**
 * `slot_list` - N labeled editable single-line slots. Each slot holds
 * a string at `character[field][key]`. Generic; rulesets configure
 * the slots array.
 *
 *   { kind: 'slot_list', field, label, slots: [{ key, label }, …] }
 */
export function SlotList({ ui, character, config }) {
  const field = config?.field;
  const slots = Array.isArray(config?.slots) ? config.slots : [];
  const current = (character?.[field] && typeof character[field] === 'object') ? character[field] : {};

  const onBlur = (key) => (e) => {
    const next = e.target.value;
    if (next === (current[key] ?? '')) return;
    const patch = { [field]: { ...current, [key]: next } };
    ui?.patchEntity?.(character.id, patch);
  };

  const sectionLabel = config?.label ?? '';
  const headerId = `slot-list-${field}-h`;

  return h('section', { class: 'narrative-section', 'aria-labelledby': headerId }, [
    h('div', { class: 'section-header', id: headerId }, sectionLabel),
    h('div', { class: 'narrative-slots', role: 'group', 'aria-labelledby': headerId },
      slots.map((slot) => {
        const value = current[slot.key] ?? '';
        return h('div', { key: slot.key, class: 'narrative-slots__row' }, [
          h('label', {
            class: 'narrative-slots__label',
            for: `slot-${field}-${slot.key}`,
          }, slot.label),
          h('input', {
            type: 'text',
            id: `slot-${field}-${slot.key}`,
            class: `form-input narrative-slots__input${value ? '' : ' is-empty'}`,
            placeholder: slot.label,
            defaultValue: value,
            onBlur: onBlur(slot.key),
            autocomplete: 'off',
          }),
        ]);
      })),
  ]);
}

/**
 * `box_track` - generalized stress-track primitive. Supports multiple
 * named tracks via `config.tracks`; back-compat falls back to a single
 * track driven by `systemConfig.harm_model.boxes` (legacy `stress_boxes`).
 *
 *   { kind: 'box_track', field, label,
 *     tracks?: [{ name, capacities: [1,2,3] }, …] }
 *
 * Multi-track shape: character[field] = { Physical: [bool,…], … }
 * Legacy shape:      character[field] = [bool, …]
 */
export function BoxTrack({ ui, character, config }) {
  const field = config?.field ?? 'stress';
  const label = config?.label ?? 'Stress';
  const multi = Array.isArray(config?.tracks) && config.tracks.length > 0;

  if (multi) {
    const tracksValue = (character?.[field] && typeof character[field] === 'object' && !Array.isArray(character[field]))
      ? character[field] : {};
    const toggle = (trackName, idx, capacity) => () => {
      const current = Array.isArray(tracksValue[trackName])
        ? tracksValue[trackName].slice()
        : Array.from({ length: capacity }, () => false);
      while (current.length < capacity) current.push(false);
      current[idx] = !current[idx];
      ui?.patchEntity?.(character.id, { [field]: { ...tracksValue, [trackName]: current } });
    };
    return h('section', { class: 'narrative-section' }, [
      h('div', { class: 'section-header' }, label),
      h('div', { role: 'group', 'aria-label': label },
        config.tracks.map((t) => {
          const caps = Array.isArray(t.capacities) ? t.capacities : [];
          const arr = Array.isArray(tracksValue[t.name]) ? tracksValue[t.name] : [];
          return h('fieldset', { key: t.name, class: 'narrative-track' }, [
            h('legend', null, t.name),
            h('div', { class: 'narrative-track__boxes' },
              caps.map((cap, i) => h('label', {
                key: i,
                class: 'narrative-track__box',
                title: `${t.name} ${cap}`,
              }, [
                h('input', {
                  type: 'checkbox',
                  checked: arr[i] === true,
                  onChange: toggle(t.name, i, caps.length),
                  'aria-label': `${t.name} ${cap}${arr[i] ? ' (checked)' : ''}`,
                }),
                h('span', null, cap),
              ]))),
          ]);
        })),
    ]);
  }

  // Legacy single-track path. Read capacities from ruleset; values from
  // a flat array on the character.
  const boxes = ui?.state?.settings?.systemConfig?.harm_model?.boxes ?? [];
  const checked = Array.isArray(character?.[field]) ? character[field] : boxes.map(() => false);
  const toggle = (i) => () => {
    const next = boxes.map((_, j) => (j === i ? !checked[j] : (checked[j] === true)));
    ui?.patchEntity?.(character.id, { [field]: next });
  };
  return h('section', { class: 'narrative-section' }, [
    h('div', { class: 'section-header' }, label),
    h('fieldset', { class: 'narrative-track' }, [
      h('legend', { class: 'sr-only' }, label),
      h('div', { class: 'narrative-track__boxes' },
        boxes.map((cap, i) => h('label', {
          key: i,
          class: 'narrative-track__box',
          title: `${label} ${cap}`,
        }, [
          h('input', {
            type: 'checkbox',
            checked: checked[i] === true,
            onChange: toggle(i),
            'aria-label': `${label} ${cap}${checked[i] ? ' (checked)' : ''}`,
          }),
          h('span', null, cap),
        ]))),
    ]),
  ]);
}

/**
 * `resource_pool` - discrete spend/refill integer pool. Sister to
 * `resource_track` (HP-bar variant); this one is a number with +/−
 * and optional Refresh-to-N buttons.
 *
 *   { kind: 'resource_pool', field, label,
 *     min?, max_field?, refresh_field? }
 */
export function ResourcePool({ ui, character, config }) {
  const field = config?.field;
  const label = config?.label ?? '';
  const cur = Number(character?.[field] ?? 0);
  const min = Number(config?.min ?? 0);
  const max = config?.max_field != null ? Number(character?.[config.max_field] ?? Infinity) : Infinity;
  const refreshTo = config?.refresh_field != null ? character?.[config.refresh_field] : undefined;

  const set = (next) => ui?.patchEntity?.(character.id, { [field]: next });
  const dec = () => { if (cur > min) set(cur - 1); };
  const inc = () => { if (cur < max) set(cur + 1); };
  const refresh = () => {
    const n = Number(refreshTo);
    if (Number.isFinite(n)) set(n);
  };

  const valueLabel = max !== Infinity ? `${cur} / ${max}` : String(cur);
  return h('div', {
    class: 'narrative-pool',
    role: 'group',
    'aria-label': `${label} (${valueLabel})`,
  }, [
    h('span', { class: 'narrative-pool__label' }, label),
    h('span', {
      class: 'narrative-pool__value',
      'aria-live': 'polite',
      'aria-atomic': 'true',
    }, valueLabel),
    h('button', {
      type: 'button', class: 'dbt dbt--compact',
      'aria-label': `Decrease ${label}`,
      title: `Decrease ${label}`,
      onClick: dec, disabled: cur <= min,
    }, '−'),
    h('button', {
      type: 'button', class: 'dbt dbt--compact',
      'aria-label': `Increase ${label}`,
      title: `Increase ${label}`,
      onClick: inc, disabled: cur >= max,
    }, '+'),
    refreshTo != null && h('button', {
      type: 'button', class: 'dbt dbt--sm',
      'aria-label': `Refresh ${label} to ${refreshTo}`,
      title: `Reset ${label} to ${refreshTo}`,
      onClick: refresh,
      disabled: cur === Number(refreshTo),
    }, `Refresh → ${refreshTo}`),
  ]);
}

/**
 * `button_action` - single button that fires an announce template and
 * adjusts one numeric field. Standalone variant of tagged_list's
 * row_action; same template substitution + disable predicate.
 *
 *   { kind: 'button_action', label, announce,
 *     increment_field? | decrement_field?, amount?,
 *     disable_when_lte?: { field, value } }
 */
export function ButtonAction({ ui, character, config }) {
  const both = config?.increment_field && config?.decrement_field;
  const disabled = isDisabled(character, config?.disable_when_lte);
  const actorName =
    ui?.widgetManager?.displayName ?? ui?.auth?.displayName ?? ui?.widgetManager?.userId ?? 'GM';

  const fire = () => {
    if (disabled || both) return;
    const message = substituteTemplate(config?.announce ?? '', { actor: actorName });
    dispatchAnnounce(ui, message);
    const amount = Number(config?.amount ?? 1);
    if (config?.increment_field) {
      const cur = Number(character?.[config.increment_field] ?? 0);
      ui?.patchEntity?.(character.id, { [config.increment_field]: cur + amount });
    } else if (config?.decrement_field) {
      const cur = Number(character?.[config.decrement_field] ?? 0);
      ui?.patchEntity?.(character.id, { [config.decrement_field]: cur - amount });
    }
  };

  return h('div', { class: 'narrative-section' },
    h('button', {
      type: 'button',
      class: 'dbt dbt--sm',
      disabled,
      'aria-label': disabled ? `${config?.label ?? ''} - unavailable` : undefined,
      title: disabled ? 'Not enough resources' : undefined,
      onClick: fire,
    }, config?.label ?? ''),
  );
}

/**
 * `pending_modifiers_list` - visualization for the dice-path
 * integration. Shows queued {value, source} entries from
 * `character.pending_modifiers` so a player can review (and Cancel) a
 * misclicked Invoke before it's consumed by the next roll. Renders
 * nothing when the stack is empty.
 */
export function PendingModifiersList({ ui, character, config }) {
  const stack = Array.isArray(character?.pending_modifiers) ? character.pending_modifiers : [];
  if (stack.length === 0) return null;
  const label = config?.label ?? 'Pending modifiers';

  const cancelOne = (idx) => {
    const next = stack.filter((_, i) => i !== idx);
    ui?.patchEntity?.(character.id, { pending_modifiers: next });
  };
  const clearAll = () => {
    ui?.patchEntity?.(character.id, { pending_modifiers: [] });
  };

  // Pre-compute the total so screen readers and the user both see
  // "what's about to be added to my next roll" at a glance.
  const total = stack.reduce((s, m) => s + (Number(m?.value) || 0), 0);
  const totalSigned = total >= 0 ? `+${total}` : String(total);
  const headerId = 'pending-mods-h';

  return h('section', {
    class: 'narrative-section narrative-pending',
    'aria-labelledby': headerId,
  }, [
    h('div', { class: 'section-header', id: headerId },
      `${label} (${totalSigned} on next roll)`),
    h('ul', { class: 'narrative-list' }, stack.map((m, i) => {
      const v = Number(m?.value) || 0;
      const signed = v >= 0 ? `+${v}` : String(v);
      const source = m?.source ?? '';
      return h('li', { key: i, class: 'narrative-pending__row' }, [
        h('span', {
          class: 'narrative-pending__value',
          'aria-label': `${signed} from`,
        }, signed),
        h('span', { class: 'narrative-pending__source' }, source),
        h('button', {
          type: 'button',
          class: 'dbt dbt--sm dbt--ghost',
          'aria-label': `Cancel ${signed} from ${source || 'pending modifier'}`,
          title: 'Remove this modifier from the next roll',
          onClick: () => cancelOne(i),
        }, 'Cancel'),
      ]);
    })),
    stack.length > 1 && h('button', {
      type: 'button',
      class: 'dbt dbt--sm dbt--ghost',
      'aria-label': `Clear all ${stack.length} pending modifiers`,
      title: 'Remove all queued modifiers',
      onClick: clearAll,
    }, 'Clear all'),
  ]);
}
