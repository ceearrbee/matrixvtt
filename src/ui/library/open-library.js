/**
 * Entry point for the content library modal. Standalone-only: the raw
 * MatrixClient (needed for the personal library room) is exposed only by
 * ClientManager, so widget mode hides the feature entirely.
 */

import { h } from 'preact';
import { Modal } from '../Modal.jsx';
import { openModal } from '../modal-host.js';
import { LibraryManager } from '../../library/LibraryManager.js';
import { getLibrarySources } from '../../library/sources.js';
import { LibraryBrowser } from './LibraryBrowser.jsx';
import { libraryAvailable } from './availability.js';

export { libraryAvailable };

export function openLibraryBrowser(ui) {
  const client = ui.widgetManager.getMatrixClient();
  const manager = new LibraryManager(client);
  const sources = getLibrarySources(manager);
  openModal((close) => h(Modal, {
    id: 'library-modal',
    title: 'Content library',
    maxWidth: '860px',
    autoFocusSelector: '#library-search',
    onClose: close,
  }, h(LibraryBrowser, { ui, sources })));
}
