/**
 * GMTab - GM-only modal panel. Owns sub-navigation across the GM tools
 * (Tables, Combat, Fog, Environment, Templates, Import/Export, Damage Log,
 * Add Entities). Opened from the header `GM` button via
 * `openGMPanelModal`.
 */
import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Modal } from './Modal.jsx';
import { openModal } from './modal-host.js';
import { MODAL_WIDTHS } from '../utils/ui-constants.js';
import { logger } from '../utils/logger.js';
import { createGMOps } from './capabilities/gm-ops.js';
import { plSplitFailedSignal } from '../state/ui-signals.js';
import { ensurePlayerPowerLevels } from './setup-persistence.js';
import { TablesPanel } from './gm/panels/TablesPanel.jsx';
import { CombatPanel } from './gm/panels/CombatPanel.jsx';
import { FogPanel } from './gm/panels/FogPanel.jsx';
import { EnvironmentPanel } from './gm/panels/EnvironmentPanel.jsx';
import { TemplatesPanel } from './gm/panels/TemplatesPanel.jsx';
import { ImportExportPanel } from './gm/panels/ImportExportPanel.jsx';
import { DamageLogPanel } from './gm/panels/DamageLogPanel.jsx';
import { AddEntitiesPanel } from './gm/panels/AddEntitiesPanel.jsx';
import {
  DiceIcon, PlusIcon, CombatIcon, FogIcon, EnvironmentIcon,
  PeopleIcon, ImportExportIcon, DamageIcon,
} from './icons/index.jsx';

const SUBNAV = [
  { id: 'tables', label: 'Tables', Icon: DiceIcon, Component: TablesPanel },
  { id: 'add', label: 'Add', Icon: PlusIcon, Component: AddEntitiesPanel },
  { id: 'combat', label: 'Combat', Icon: CombatIcon, Component: CombatPanel },
  { id: 'fog', label: 'Fog', Icon: FogIcon, Component: FogPanel },
  { id: 'env', label: 'Environment', Icon: EnvironmentIcon, Component: EnvironmentPanel },
  { id: 'templates', label: 'Templates', Icon: PeopleIcon, Component: TemplatesPanel },
  { id: 'io', label: 'Import/Export', Icon: ImportExportIcon, Component: ImportExportPanel },
  { id: 'damage', label: 'Damage Log', Icon: DamageIcon, Component: DamageLogPanel },
];

function SubNavButton({ entry, active, onClick }) {
  return h(
    'button',
    {
      class: `dbt dbt--sm gm-subnav__btn${active ? ' gm-subnav__btn--active' : ''}`,
      'data-gm-subnav-id': entry.id,
      'aria-pressed': String(active),
      'aria-label': `Show ${entry.label}`,
      title: entry.label,
      onClick,
      style: active ? 'font-weight:600;' : '',
    },
    [h('span', { 'aria-hidden': 'true', style: 'margin-right:4px;' }, h(entry.Icon, {})), entry.label]
  );
}

export function PlSplitWarning({ ui }) {
  const gmIds = plSplitFailedSignal.value;
  if (!gmIds) return null;
  return h('div', {
    class: 'gm-pl-warning',
    role: 'alert',
    style: 'display:flex;align-items:center;gap:8px;padding:8px;margin:8px;' +
      'background:var(--color-background-warning);border:0.5px solid var(--color-border-warning);' +
      'border-radius:var(--border-radius-sm);color:var(--color-text-warning);font-size:var(--font-size-xs);',
  }, [
    h('span', { style: 'flex:1;' },
      'Player permissions were not applied: players may not be able to edit tokens or characters.'),
    h('button', {
      type: 'button', class: 'dbt dbt--sm',
      onClick: () => ensurePlayerPowerLevels(ui, gmIds),
    }, 'Retry'),
  ]);
}

export function GMTab({ ui }) {
  const [active, setActive] = useState('tables');

  if (!ui.state.isGM()) return null;

  const gm = createGMOps(ui);
  const entry = SUBNAV.find(e => e.id === active) ?? SUBNAV[0];
  const Panel = entry.Component;

  return h('div', { class: 'gm-tab' }, [
    h(PlSplitWarning, { ui }),
    h(
      'div',
      {
        class: 'gm-subnav',
        'data-gm-subnav': true,
        role: 'tablist',
        'aria-label': 'GM tool sections',
        style:
          'display:flex;flex-wrap:wrap;gap:4px;padding:8px;border-bottom:1px solid var(--color-border-primary);',
      },
      SUBNAV.map(e =>
        h(SubNavButton, {
          key: e.id,
          entry: e,
          active: e.id === active,
          onClick: () => setActive(e.id),
        })
      )
    ),
    h('div', { class: 'gm-tab__body', role: 'tabpanel' }, h(Panel, { ui, gm })),
  ]);
}

export function openGMPanelModal(ui) {
  if (!ui.state.isGM()) {
    logger.error('UI', 'Permission denied - only GM can access GM tools');
    ui._toast?.('Only the GM can access GM tools', 'error');
    return;
  }
  openModal((close) =>
    h(Modal, { id: 'gm-panel-modal', title: 'GM tools', maxWidth: MODAL_WIDTHS.LARGE, onClose: close },
      h(GMTab, { ui }),
    ),
  );
}
