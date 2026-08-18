/**
 * AccessibilityPanel.jsx - Accessibility and display preferences.
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { getAccessibilitySettings, setAccessibilitySetting } from './settings-helpers.js';

export function AccessibilityPanel() {
  const [settings, setSettings] = useState(getAccessibilitySettings());

  const toggle = (key) => {
    const newVal = !settings[key];
    setAccessibilitySetting(key, newVal);
    setSettings({ ...settings, [key]: newVal });
  };

  const onThemeChange = (e) => {
    const val = e.target.value;
    setAccessibilitySetting('theme', val);
    setSettings({ ...settings, theme: val });
  };

  return h('div', { class: 'settings-section', role: 'group', 'aria-labelledby': 'acc-settings-title' }, [
    h('div', { class: 'settings-section__title', id: 'acc-settings-title' }, 'Accessibility & Display'),
    h('label', { class: 'form-label settings-toggle', title: 'Minimize UI animations' }, [
      h('input', { type: 'checkbox', id: 'acc-reduced-motion', checked: settings.reduced_motion, onChange: () => toggle('reduced_motion') }),
      ' Reduced motion',
    ]),
    h('label', { class: 'form-label', for: 'acc-theme', title: 'Pick a theme; Auto follows your OS setting', style: 'margin-top:8px;' }, 'Theme'),
    h('select', { id: 'acc-theme', class: 'form-select', 'aria-label': 'Theme', value: settings.theme, onChange: onThemeChange }, [
      h('option', { value: 'auto' }, 'Auto (follow system)'),
      h('option', { value: 'dark' }, 'Dark'),
      h('option', { value: 'light' }, 'Light'),
      h('option', { value: 'high-contrast' }, 'High contrast'),
      h('option', { value: 'nondescript' }, 'Nondescript'),
    ]),
  ]);
}
