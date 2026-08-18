/**
 * CombatAutomationPanel.jsx - Combat automation settings.
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { getCombatSettings, setCombatSetting } from './settings-helpers.js';
import { useStorageSubscription } from './hooks/use-storage.js';

const INIT_MODE_KEY = 'vtt:initiative-mode-override';

export function CombatAutomationPanel() {
  const [settings, setSettings] = useState(getCombatSettings());
  // Cross-tab synced: another tab changing the initiative mode is
  // reflected here too via the `storage` event.
  const [initModeRaw, setInitModeStored] = useStorageSubscription(INIT_MODE_KEY);
  const initMode = initModeRaw || 'auto';

  const toggle = (key) => {
    const newVal = !settings[key];
    setCombatSetting(key, newVal);
    setSettings({ ...settings, [key]: newVal });
  };

  const onInitModeChange = (e) => {
    setInitModeStored(e.target.value);
  };

  return h('div', { class: 'settings-section', role: 'group', 'aria-labelledby': 'ca-settings-title' }, [
    h('div', { class: 'settings-section__title', id: 'ca-settings-title' }, 'Combat Automation'),
    h('label', { class: 'form-label', for: 'ca-init-mode', title: 'How initiative order is resolved when combat starts' }, [
      'Initiative mode',
      h('select', { class: 'form-select', id: 'ca-init-mode', value: initMode, onChange: onInitModeChange }, [
        h('option', { value: 'auto' }, 'Use ruleset default'),
        h('option', { value: 'individual' }, 'Individual: each combatant rolls'),
        h('option', { value: 'side' }, 'Side-based: one roll per side'),
        h('option', { value: 'static' }, 'Static: rank by stat (no roll)'),
      ]),
    ]),
    h('label', { class: 'form-label settings-toggle', title: 'Automatically advance turn when HP reaches 0' }, [
      h('input', { type: 'checkbox', id: 'ca-auto-advance', checked: settings.auto_advance_on_death, onChange: () => toggle('auto_advance_on_death') }),
      ' Auto-advance on death',
    ]),
    h('label', { class: 'form-label settings-toggle', title: 'Announce round changes in chat' }, [
      h('input', { type: 'checkbox', id: 'ca-auto-announce', checked: settings.auto_announce_round, onChange: () => toggle('auto_announce_round') }),
      ' Announce rounds',
    ]),
    h('label', { class: 'form-label settings-toggle', title: 'Auto-roll NPC initiative on combat start' }, [
      h('input', { type: 'checkbox', id: 'ca-auto-roll-npc', checked: settings.auto_roll_npc_initiative, onChange: () => toggle('auto_roll_npc_initiative') }),
      ' Auto-roll NPC initiative',
    ]),
    h('label', { class: 'form-label settings-toggle', title: 'Reveal fog around tokens on move (GM only)' }, [
      h('input', { type: 'checkbox', id: 'ca-auto-reveal', checked: settings.auto_reveal_fog, onChange: () => toggle('auto_reveal_fog') }),
      ' Auto-reveal fog on move',
    ]),
  ]);
}
