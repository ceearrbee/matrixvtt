/**
 * Replace [[Title]] wikilinks with anchor tags. Unknown titles become a
 * "broken" span so authors notice dead links. Titles are HTML-escaped.
 *
 * Namespaced forms (when the optional refs argument is provided):
 *   - `[[roll:<table-id>]]`  - 🎲 Roll button. Routed via
 *                              `data-roll-table` to `ui.rollTable`.
 *   - `[[char:<id>]]`        - link to character preview popup.
 *   - `[[npc:<id>]]`         - link to NPC preview popup.
 *   - `[[item:<id>]]`        - link to item preview popup.
 *   - `[[spell:<id>]]`       - link to spell preview popup.
 *   - `[[map:<id>]]`         - switch-map link. Routed via
 *                              `data-map-id` to `switchMap`.
 *
 * Unknown ids fall through to a broken-span so demo authors notice
 * dead references.
 *
 * @param {string} text
 * @param {Map<string, string>} titleToId  handout title → id
 * @param {Map<string, {name: string}>=} tablesById
 * @param {{
 *   pagesByTitle?: Map<string, string>,
 *   characters?: Map<string, {name?: string}>,
 *   npcs?:       Map<string, {name?: string}>,
 *   items?:      Map<string, {name?: string}>,
 *   spells?:     Map<string, {name?: string}>,
 *   maps?:       Map<string, {name?: string}>,
 * }=} refs
 */

const WIKILINK = /\[\[([^[\]]+)\]\]/g;

const PREVIEW_KINDS = {
  char:  { kind: 'character', collection: 'characters' },
  npc:   { kind: 'npc',       collection: 'npcs' },
  item:  { kind: 'item',      collection: 'items' },
  spell: { kind: 'spell',     collection: 'spells' },
};

export function renderWikilinks(text, titleToId, tablesById = null, refs = null) {
  if (typeof text !== 'string' || text.length === 0) return text;
  return text.replace(WIKILINK, (_, rawTitle) => {
    const title = rawTitle.trim();

    // Roll-on-table form.
    if (title.startsWith('roll:')) {
      const tableId = title.slice('roll:'.length).trim();
      const table = tablesById?.get?.(tableId);
      if (table?.name) {
        const safeId = escapeHtml(tableId);
        const safeName = escapeHtml(table.name);
        return `<a href="#" data-roll-table="${safeId}" class="wikilink wikilink--roll">🎲 Roll ${safeName}</a>`;
      }
      return `<span class="wikilink wikilink--broken">${escapeHtml(title)}</span>`;
    }

    // Map-switch form.
    if (title.startsWith('map:')) {
      const mapId = title.slice('map:'.length).trim();
      const map = refs?.maps?.get?.(mapId);
      if (map?.name) {
        const safeId = escapeHtml(mapId);
        const safeName = escapeHtml(map.name);
        return `<a href="#" data-map-id="${safeId}" class="wikilink wikilink--map">🗺️ ${safeName}</a>`;
      }
      return `<span class="wikilink wikilink--broken">${escapeHtml(title)}</span>`;
    }

    // Entity / item / spell preview forms.
    const colonIdx = title.indexOf(':');
    if (colonIdx > 0) {
      const prefix = title.slice(0, colonIdx);
      const cfg = PREVIEW_KINDS[prefix];
      if (cfg) {
        const id = title.slice(colonIdx + 1).trim();
        const entity = refs?.[cfg.collection]?.get?.(id);
        if (entity) {
          const safeId = escapeHtml(id);
          const safeName = escapeHtml(entity.name || id);
          return `<a href="#" data-preview-kind="${cfg.kind}" data-preview-id="${safeId}" class="wikilink wikilink--preview">${safeName}</a>`;
        }
        return `<span class="wikilink wikilink--broken">${escapeHtml(title)}</span>`;
      }
    }

    const escaped = escapeHtml(title);
    const pageId = refs?.pagesByTitle?.get?.(title);
    if (pageId) {
      const safeId = escapeHtml(pageId);
      return `<a href="#" data-page-id="${safeId}" class="wikilink wikilink--page">${escaped}</a>`;
    }
    const id = titleToId.get(title);
    if (id) {
      const safeId = escapeHtml(id);
      return `<a href="#" data-handout-id="${safeId}" class="wikilink">${escaped}</a>`;
    }
    return `<span class="wikilink wikilink--broken">${escaped}</span>`;
  });
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
