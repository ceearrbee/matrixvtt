/**
 * RulesetValidator.jsx - diagnostic panel that runs a pasted or uploaded
 * ruleset JSON through validateRuleset and lists errors + warnings
 * inline. No save step; the panel is read-only.
 *
 * Mounted by openRulesetValidator(ui); closes the wrapper on request.
 */

import { h } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { Modal } from './Modal.jsx';
import { openModal } from './modal-host.js';
import { validateRuleset, CURRENT_SPEC_VERSION } from '../engine/validateRuleset.js';

function tryParse(text) {
  try { return { ok: true, value: JSON.parse(text) }; }
  catch (err) { return { ok: false, error: err.message }; }
}

function ValidatorPanel() {
  const [result, setResult] = useState(null);
  const [parseError, setParseError] = useState('');
  const textareaRef = useRef(null);

  const run = (text) => {
    setParseError('');
    if (!text.trim()) { setResult(null); return; }
    const parsed = tryParse(text);
    if (!parsed.ok) {
      setParseError(parsed.error);
      setResult(null);
      return;
    }
    // Strip the export-only marker so validator sees just the ruleset payload.
    // eslint-disable-next-line no-unused-vars
    const { vtt_export_type, vtt_version, ...ruleset } = parsed.value ?? {};
    setResult(validateRuleset(ruleset));
  };

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    if (textareaRef.current) textareaRef.current.value = text;
    run(text);
    e.target.value = '';
  };

  return h('div', { style: 'display:flex;flex-direction:column;gap:10px;' }, [
    h('div', { style: 'font-size:12px;color:var(--color-text-secondary);' },
      `Engine spec version: ${CURRENT_SPEC_VERSION}. Paste a ruleset JSON or upload a .vttruleset.json file.`),

    h('div', { style: 'display:flex;gap:8px;align-items:center;' }, [
      h('label', { class: 'dbt dbt--sm', style: 'cursor:pointer;margin:0;' }, [
        'Upload file',
        h('input', { type: 'file', accept: '.json,.vttruleset.json', style: 'display:none;', onChange: onFileChange }),
      ]),
      h('button', {
        type: 'button', class: 'dbt dbt--sm',
        onClick: () => run(textareaRef.current?.value ?? ''),
      }, 'Validate'),
      h('button', {
        type: 'button', class: 'dbt dbt--sm',
        onClick: () => {
          if (textareaRef.current) textareaRef.current.value = '';
          setResult(null); setParseError('');
        },
      }, 'Clear'),
    ]),

    h('textarea', {
      ref: textareaRef,
      class: 'form-textarea',
      rows: 12,
      placeholder: '{\n  "meta": { "name": "My System", "spec_version": "1.0" },\n  …\n}',
      style: 'width:100%;font-family:monospace;font-size:12px;',
      onInput: (e) => run(e.target.value),
    }),

    parseError && h('div', {
      style: 'padding:8px;background:var(--color-background-danger);color:var(--color-text-danger);border-radius:4px;',
    }, `JSON parse error: ${parseError}`),

    result && h(ResultPanel, { result }),
  ]);
}

function ResultPanel({ result }) {
  const { valid, errors, warnings } = result;
  return h('div', { style: 'display:flex;flex-direction:column;gap:6px;' }, [
    h('div', {
      style: `padding:6px 10px;border-radius:4px;font-weight:600;${
        valid
          ? 'background:var(--color-background-success);color:var(--color-text-success);'
          : 'background:var(--color-background-danger);color:var(--color-text-danger);'
      }`,
    }, valid
      ? `✔ Valid${warnings.length ? ` (with ${warnings.length} warning${warnings.length > 1 ? 's' : ''})` : ''}`
      : `✗ Invalid - ${errors.length} error${errors.length > 1 ? 's' : ''}`),

    errors.length > 0 && h('ul', { style: 'margin:0;padding-left:20px;' },
      errors.map((e, i) => h('li', {
        key: i, style: 'color:var(--color-text-danger);font-family:monospace;font-size:12px;',
      }, e))),

    warnings.length > 0 && h('ul', { style: 'margin:0;padding-left:20px;' },
      warnings.map((w, i) => h('li', {
        key: i, style: 'color:var(--color-text-warning);font-family:monospace;font-size:12px;',
      }, w))),
  ]);
}

export function openRulesetValidator() {
  openModal((close) =>
    h(Modal, { id: 'ruleset-validator-modal', title: 'Validate Ruleset', maxWidth: '720px', onClose: close },
      h(ValidatorPanel, {}),
    ),
  );
}
