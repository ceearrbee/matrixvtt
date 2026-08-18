/**
 * Library source abstraction. The browser UI iterates an array of sources
 * so new backends (bundled JSON, a personal room, later public community
 * rooms) plug in without UI changes.
 *
 * Source shape:
 *   { id, label, writable, listEntries(kind?), getEntry(id) }
 * Writable sources also expose saveEntry / deleteEntry / renameEntry.
 */

import { buildSearchIndex } from '../content/compendium/search-index.js';
import { loadCommunityLibrary } from '../content/library/index.js';

/** Filter entries by a case-insensitive name substring. */
export function filterEntries(entries, text) {
  return buildSearchIndex(entries).searchByName(text);
}

/** A read-only source backed by a lazily loaded list of entries. */
export function createBundledSource(id, label, load) {
  let cache = null;
  const all = async () => (cache ??= await load());
  return {
    id,
    label,
    writable: false,
    async listEntries(kind = null) {
      const entries = await all();
      return kind ? entries.filter((e) => e.kind === kind) : entries;
    },
    async getEntry(entryId) {
      return (await all()).find((e) => e.id === entryId) ?? null;
    },
  };
}

/** A writable source backed by the user's personal library room. */
export function createPersonalSource(libraryManager) {
  return {
    id: 'personal',
    label: 'My library',
    writable: true,
    listEntries: (kind = null) => libraryManager.listEntries(kind),
    async getEntry(entryId) {
      const entries = await libraryManager.listEntries();
      return entries.find((e) => e.id === entryId) ?? null;
    },
    saveEntry: (entry) => libraryManager.saveEntry(entry),
    deleteEntry: (id) => libraryManager.deleteEntry(id),
    renameEntry: (id, name) => libraryManager.renameEntry(id, name),
  };
}

/**
 * Build the ordered source list for the browser: the user's personal
 * library first, then the bundled community catalog.
 * @param {import('./LibraryManager.js').LibraryManager} libraryManager
 */
export function getLibrarySources(libraryManager) {
  return [
    createPersonalSource(libraryManager),
    createBundledSource('community', 'Community', loadCommunityLibrary),
  ];
}
