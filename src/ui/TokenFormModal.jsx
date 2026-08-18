/**
 * TokenFormModal - Preact token-edit modal. Created / destroyed
 * imperatively via `showTokenFormModal(ui, tokenId)`.
 *
 * Preact children are auto-escaped, so user-authored fields (name,
 * color, image_url, aura_color) render structurally and cannot break
 * out of attribute context.
 */

import { h, render } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { trapFocusIn } from '../utils/ui-helpers.js';
import { DISPOSITIONS, ENTITY_TYPES } from '../utils/constants.js';
import { TOKEN_COLORS, TOKEN_SWATCHES } from '../utils/ui-constants.js';
import { PortraitUploader } from './token-form/PortraitUploader.jsx';
import { VariantListEditor, initialVariants } from './token-form/VariantListEditor.jsx';
import { TrackerListEditor, initialTrackers } from './token-form/TrackerListEditor.jsx';
import { AuraListEditor, initialAuras } from './token-form/AuraListEditor.jsx';
import { rowKey } from '../utils/row-key.js';
import { rulesetTracksHP, rulesetHasFormField } from './entity-form/system-fields.js';


function Modal({ ui, token, onClose }) {
  const isEdit = !!token;
  const systemConfig = ui.state.settings?.systemConfig;
  const showHP = rulesetTracksHP(systemConfig);
  const showAC = rulesetHasFormField(systemConfig, 'ac');
  const [color, setColor] = useState(isEdit ? (token.color ?? TOKEN_SWATCHES[0]) : TOKEN_SWATCHES[0]);
  const [portraitUrl, setPortraitUrl] = useState(isEdit ? (token.image_url ?? '') : '');
  const [uploading, setUploading] = useState(false);
  const [auras, setAuras] = useState(initialAuras(token));
  const [trackers, setTrackers] = useState(initialTrackers(token));
  const [variants, setVariants] = useState(initialVariants(token));
  const formRef = useRef(null);

  const addVariant = () => setVariants([...variants, { _key: rowKey(), label: '', image_url: '' }]);
  const removeVariant = (i) => setVariants(variants.filter((_, j) => j !== i));
  const updateVariant = (i, patch) =>
    setVariants(variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  // "Use" stages the variant's image as the live portrait. Stays in
  // React state until Save so the change is reversible via Cancel.
  const applyVariant = (i) => {
    const v = variants[i];
    if (v?.image_url) setPortraitUrl(v.image_url);
  };

  const addAura = () => setAuras([...auras, { _key: rowKey(), radius: 2, color: TOKEN_COLORS.AURA_DEFAULT }]);
  const removeAura = (i) => setAuras(auras.filter((_, j) => j !== i));
  const updateAura = (i, patch) =>
    setAuras(auras.map((a, j) => (j === i ? { ...a, ...patch } : a)));

  const addTracker = () => setTrackers([...trackers, { _key: rowKey(), label: '', value: 0, max: '' }]);
  const removeTracker = (i) => setTrackers(trackers.filter((_, j) => j !== i));
  const updateTracker = (i, patch) =>
    setTrackers(trackers.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  const onPortraitFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await ui.widgetManager.uploadMedia(file);
      setPortraitUrl(url || '');
    } catch (err) {
      ui._toast?.('Portrait upload failed: ' + (err?.message || 'unknown'), 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (uploading) return;
    const form = formRef.current;
    const val = (id) => /** @type {HTMLInputElement} */ (form.querySelector(`#${id}`))?.value ?? '';
    const num = (id) => parseInt(val(id), 10) || 0;

    const imgRaw = (portraitUrl || val('token-image-url') || '').trim();
    const cleanAuras = auras
      .filter((a) => Number(a.radius) > 0)
      .map((a) => ({ radius: Number(a.radius), color: a.color || TOKEN_COLORS.AURA_DEFAULT }));
    const cleanVariants = variants
      .filter((v) => v.label && v.label.trim() !== '' && v.image_url && v.image_url.trim() !== '')
      .map((v) => ({ label: v.label.trim(), image_url: v.image_url.trim() }));
    const cleanTrackers = trackers
      .filter((t) => t.label && t.label.trim() !== '')
      .map((t) => {
        const out = { label: t.label.trim(), value: Number(t.value) || 0 };
        if (t.max !== '' && t.max !== null && t.max !== undefined && Number.isFinite(Number(t.max))) {
          out.max = Number(t.max);
        }
        return out;
      });
    const data = {
      name: val('token-name'),
      type: val('token-type'),
      size: num('token-size'),
      ...(showHP ? { hp_current: num('token-hp-current'), hp_max: num('token-hp-max') } : {}),
      ...(showAC ? { ac: num('token-ac') } : {}),
      col: num('token-col'),
      row: num('token-row'),
      color,
      disposition: val('token-disposition'),
      image_url: imgRaw || null,
      auras: cleanAuras,
      trackers: cleanTrackers,
      variants: cleanVariants,
      // Retire the legacy single-aura fields whenever the form saves
      // so the new `auras[]` shape is the only source of truth going
      // forward. Renderer still accepts the legacy shape for any
      // unmigrated tokens authored by external tools / older clients.
      aura_radius: 0,
      aura_color: null,
    };

    if (isEdit) await ui.updateToken(token.id, data);
    else await ui.createToken(data);
    onClose();
  };

  const swatch = (c, i) => h('button', {
    key: c + i,
    type: 'button',
    class: `color-swatch${c === color ? ' selected' : ''}`,
    style: `background: ${c};`,
    'aria-label': `Select ${c} color`,
    'aria-pressed': String(c === color),
    onClick: () => setColor(c),
  });

  return h('div', {
    class: 'modal-overlay',
    id: 'token-form-modal',
    onClick: (e) => { if (e.target === e.currentTarget) onClose(); },
    onKeyDown: (e) => { if (e.key === 'Escape') onClose(); },
  },
    h('div', {
      class: 'modal-content',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'token-form-title',
      style: 'max-width: 500px;',
    }, [
      h('div', { class: 'modal-header' }, [
        h('h2', { id: 'token-form-title' }, isEdit ? 'Edit Token' : 'Add Token'),
        h('button', { class: 'modal-close', 'aria-label': 'Close', onClick: onClose }, '✕'),
      ]),
      h('div', { class: 'modal-body' },
        h('form', { id: 'token-form', ref: formRef, onSubmit }, [
          h('div', { class: 'form-group' }, [
            h('label', { class: 'form-label', for: 'token-name' }, ['Token Name ', h('span', { 'aria-hidden': 'true' }, '*')]),
            h('input', {
              type: 'text', class: 'form-input', id: 'token-name',
              placeholder: 'e.g., Goblin', required: true, 'aria-required': 'true',
              defaultValue: isEdit ? (token.name ?? '') : '',
            }),
          ]),
          h('div', { class: 'form-row' }, [
            h('div', { class: 'form-group' }, [
              h('label', { class: 'form-label', for: 'token-type' }, 'Type'),
              h('select', {
                class: 'form-select', id: 'token-type',
                defaultValue: isEdit ? token.type : ENTITY_TYPES.NPC,
              }, [
                h('option', { value: ENTITY_TYPES.NPC }, 'NPC'),
                h('option', { value: ENTITY_TYPES.PC }, 'Player Character'),
                h('option', { value: 'object' }, 'Object'),
              ]),
            ]),
            h('div', { class: 'form-group' }, [
              h('label', { class: 'form-label', for: 'token-size' }, 'Size'),
              h('select', {
                class: 'form-select', id: 'token-size',
                defaultValue: String(isEdit ? token.size : 1),
              }, [
                h('option', { value: '1' }, 'Medium (1x1)'),
                h('option', { value: '2' }, 'Large (2x2)'),
                h('option', { value: '3' }, 'Huge (3x3)'),
              ]),
            ]),
          ]),
          h('div', { class: 'form-group' }, [
            h('label', {
              class: 'form-label', for: 'token-disposition',
              title: 'Side used for side-based initiative and ally/enemy identification',
            }, 'Disposition'),
            h('select', {
              class: 'form-select', id: 'token-disposition',
              defaultValue: (isEdit && token.disposition) ? token.disposition : DISPOSITIONS.NEUTRAL,
            }, [
              h('option', { value: DISPOSITIONS.NEUTRAL }, 'Neutral'),
              h('option', { value: DISPOSITIONS.FRIENDLY }, 'Friendly (ally)'),
              h('option', { value: DISPOSITIONS.HOSTILE }, 'Hostile (enemy)'),
            ]),
          ]),
          showHP && h('div', { class: 'form-row' }, [
            h('div', { class: 'form-group' }, [
              h('label', { class: 'form-label', for: 'token-hp-current' }, 'HP Current'),
              h('input', { type: 'number', class: 'form-input', id: 'token-hp-current', min: 0, defaultValue: isEdit ? token.hp_current : 10 }),
            ]),
            h('div', { class: 'form-group' }, [
              h('label', { class: 'form-label', for: 'token-hp-max' }, 'HP Max'),
              h('input', { type: 'number', class: 'form-input', id: 'token-hp-max', min: 1, defaultValue: isEdit ? token.hp_max : 10 }),
            ]),
          ]),
          h('div', { class: 'form-row' }, [
            showAC && h('div', { class: 'form-group' }, [
              h('label', { class: 'form-label', for: 'token-ac' }, 'AC'),
              h('input', { type: 'number', class: 'form-input', id: 'token-ac', min: 0, defaultValue: isEdit ? token.ac : 10 }),
            ]),
            h('div', { class: 'form-group' }, [
              h('label', { class: 'form-label', for: 'token-col' }, 'Position (Col, Row)'),
              h('div', { style: 'display: flex; gap: 4px;' }, [
                h('input', { type: 'number', class: 'form-input', id: 'token-col', min: 0, max: 20, defaultValue: isEdit ? token.col : 3 }),
                h('input', { type: 'number', class: 'form-input', id: 'token-row', min: 0, max: 20, defaultValue: isEdit ? token.row : 3 }),
              ]),
            ]),
          ]),
          h('div', { class: 'form-group' }, [
            h('label', { class: 'form-label', for: 'token-color' }, 'Color'),
            h('div', { class: 'color-picker-grid', id: 'color-picker' },
              TOKEN_SWATCHES.map((c, i) => swatch(c, i))),
            h('input', { type: 'hidden', id: 'token-color', value: color }),
          ]),
          h(PortraitUploader, { ui, portraitUrl, setPortraitUrl, uploading, onPortraitFile }),
          h(AuraListEditor, { auras, addAura, removeAura, updateAura }),
          h(TrackerListEditor, { trackers, addTracker, removeTracker, updateTracker }),
          h(VariantListEditor, { variants, addVariant, removeVariant, updateVariant, applyVariant }),
          h('div', { class: 'form-actions' }, [
            h('button', { type: 'button', class: 'dbt', onClick: onClose }, 'Cancel'),
            h('button', { type: 'submit', class: 'dbt btn-primary' }, isEdit ? 'Save Token' : 'Add Token'),
          ]),
        ])),
    ]));
}

export function showTokenFormModal(ui, tokenId = null) {
  const trigger = /** @type {HTMLElement|null} */ (document.activeElement);
  const token = tokenId ? ui.state.tokens.get(tokenId) : null;

  const host = document.createElement('div');
  document.body.appendChild(host);

  const close = () => {
    render(null, host);
    host.remove();
    trigger?.focus?.();
  };

  render(h(Modal, { ui, token, onClose: close }), host);

  // Focus + focus-trap the first interactive element.
  const modal = /** @type {HTMLElement} */ (host.querySelector('.modal-overlay'));
  if (modal) {
    trapFocusIn(modal);
    /** @type {HTMLElement|null} */ (modal.querySelector('input, select, button'))?.focus();
  }
}
