/**
 * ruleset-io.js - export / import active ruleset as a `.vttruleset.json` file.
 */

import { validateRuleset } from '../engine/validateRuleset.js';

export function exportRuleset(ui) {
  const systemConfig = ui.state.settings.systemConfig;
  if (!systemConfig) {
    ui._toast('No active ruleset to export', 'info');
    return;
  }
  const data = {
    vtt_export_type: 'ruleset',
    vtt_version: 1,
    system: ui.state.settings.system || 'custom',
    ...systemConfig,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(systemConfig.name || 'ruleset').replace(/\s+/g, '-').toLowerCase()}.vttruleset.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Validate a ruleset config and apply it to the campaign settings.
 * Shared by file import and library insert. Returns true on success;
 * emits its own error/warning toasts.
 */
export async function applyRulesetConfig(ui, system, systemConfig) {
  const check = validateRuleset(systemConfig);
  if (!check.valid) {
    ui._toast(`Ruleset invalid: ${check.errors[0]}`, 'error');
    return false;
  }
  for (const w of check.warnings) ui._toast(`Ruleset warning: ${w}`, 'info');

  const settings = { ...ui.state.settings, system, systemConfig };
  await ui.state.updateSettings(settings);
  ui._toast(`Ruleset "${systemConfig.name || system}" applied`, 'success');
  return true;
}

export async function importRuleset(ui, file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (data.vtt_export_type !== 'ruleset') {
      ui._toast('Not a valid ruleset file', 'error');
      return;
    }

    // eslint-disable-next-line no-unused-vars
    const { vtt_export_type, vtt_version, system: importedSystem, ...systemConfig } = data;
    const system = importedSystem || 'custom';
    await applyRulesetConfig(ui, system, systemConfig);
  } catch (err) {
    ui._toast('Import failed: ' + err.message, 'error');
  }
}
