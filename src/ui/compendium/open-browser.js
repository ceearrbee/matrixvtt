/**
 * Entry point for the compendium browser modal. Availability follows
 * the campaign's system slug: only systems with a shipped compendium
 * (src/content/compendium/) show the buttons, and the data chunk is
 * fetched on first open.
 */

import { h } from 'preact';
import { Modal } from '../Modal.jsx';
import { openModal } from '../modal-host.js';
import { hasCompendium, loadCompendium } from '../../content/compendium/index.js';
import { CompendiumBrowser } from './CompendiumBrowser.jsx';

const TITLES = {
  spell: 'Add spells from the SRD',
  item: 'Add items from the SRD',
  monster: 'Add monsters from the SRD',
};

export function compendiumAvailable(ui) {
  return hasCompendium(ui.state.settings?.system);
}

export function openCompendiumBrowser(ui, kind) {
  const system = ui.state.settings?.system;
  openModal((close) => h(Modal, {
    id: 'compendium-modal',
    title: TITLES[kind],
    maxWidth: '560px',
    autoFocusSelector: '#compendium-search',
    onClose: close,
  }, h(CompendiumBrowser, { ui, kind, load: () => loadCompendium(system) })));
}
