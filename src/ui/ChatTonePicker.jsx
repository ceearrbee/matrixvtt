/**
 * ChatTonePicker - popover anchored to the tone pill in the dice bar.
 *
 * Behaviour:
 *  - Search input filters the preset list by name (case-insensitive).
 *  - Clicking a row sets `chatToneSignal.value = { name }` and closes.
 *  - "Clear" row at the top sets `chatToneSignal.value = null`.
 *  - "Custom Tone" sticky row at the bottom: name input + colour picker;
 *    submit writes `{ name, color }`.
 *  - Click-outside or Escape closes the popover.
 *
 * The popover does not use ModalFactory - it is a lightweight inline
 * overlay anchored to a button. ModalFactory is for full-screen dialogs;
 * a tone picker is too short-lived to lock body scroll for.
 */

import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { chatToneSignal } from '../state/ui-signals.js';
import { CHAT_TONES } from './chat-tones.js';
import { HelpIcon } from './HelpIcon.jsx';

export function ChatTonePicker({ onClose }) {
  const rootRef = useRef(null);
  const [query, setQuery] = useState('');
  const [customName, setCustomName] = useState('');
  const [customColor, setCustomColor] = useState('#888888');

  useEffect(() => {
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) onClose?.();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? CHAT_TONES.filter((t) => t.name.toLowerCase().includes(q))
    : CHAT_TONES;

  const pick = (tone) => {
    chatToneSignal.value = tone;
    onClose?.();
  };

  const submitCustom = () => {
    const name = customName.trim();
    if (!name) return;
    pick({ name, color: customColor });
  };

  return h('div', {
    class: 'tone-picker',
    role: 'dialog',
    'aria-label': 'Pick a speaking tone',
    ref: rootRef,
  }, [
    h('div', { class: 'tone-picker__header', style: 'display:flex;align-items:center;gap:4px;' }, [
      h(HelpIcon, { term: 'persona' }),
      h('input', {
        type: 'search',
        class: 'form-input tone-picker__search',
        placeholder: 'Search tones…',
        'aria-label': 'Search tones',
        value: query,
        onInput: (e) => setQuery(e.currentTarget.value),
        autoFocus: true,
      }),
    ]),
    h('div', { class: 'tone-picker__list', role: 'listbox' }, [
      h('button', {
        type: 'button',
        class: 'tone-picker__row tone-picker__row--clear',
        onClick: () => pick(null),
      }, '- No tone -'),
      ...filtered.map((t) => h('button', {
        key: t.name,
        type: 'button',
        class: 'tone-picker__row',
        role: 'option',
        onClick: () => pick(t),
      }, t.name)),
      filtered.length === 0 && h('div', { class: 'tone-picker__empty' }, 'No matching tones'),
    ]),
    h('div', { class: 'tone-picker__custom' }, [
      h('div', { class: 'tone-picker__custom-label' }, 'Custom tone'),
      h('div', { class: 'tone-picker__custom-row' }, [
        h('input', {
          type: 'text',
          class: 'form-input',
          placeholder: 'e.g. Drunken',
          'aria-label': 'Custom tone name',
          value: customName,
          onInput: (e) => setCustomName(e.currentTarget.value),
          onKeyDown: (e) => { if (e.key === 'Enter') submitCustom(); },
        }),
        h('input', {
          type: 'color',
          class: 'tone-picker__color',
          'aria-label': 'Custom tone colour',
          value: customColor,
          onInput: (e) => setCustomColor(e.currentTarget.value),
        }),
        h('button', {
          type: 'button',
          class: 'dbt dbt--sm',
          onClick: submitCustom,
          disabled: customName.trim().length === 0,
        }, 'Use'),
      ]),
    ]),
  ]);
}
