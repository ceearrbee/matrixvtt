/**
 * Read-only detail view for a selected library entry. Reuses the same
 * ruleset-driven card renderers as the in-campaign previews for items and
 * spells; characters, NPCs, maps, and rulesets fall back to a compact fact
 * grid so the pane stays useful even when the entry was authored under a
 * different ruleset than the current campaign.
 */

import { h } from 'preact';
import { LIBRARY_KIND } from '../../utils/constants.js';
import { previewSectionsFor } from '../preview/preview-modals.js';
import { renderItemCardSections } from '../item-card-sections.js';
import { renderSpellPreviewSections } from '../spell-preview-sections.js';
import { resolveMediaUrl } from '../../utils/mxc.js';
import { rulesetFacts, mapFacts, genericFacts } from './preview-facts.js';

function FactGrid({ facts }) {
  if (!facts.length) {
    return h('p', { class: 'library-preview__empty' }, 'No further details.');
  }
  return h('dl', { class: 'library-preview__facts' },
    facts.flatMap((f) => [
      h('dt', { key: `${f.label}-t` }, f.label),
      h('dd', { key: `${f.label}-d` }, f.value),
    ]));
}

function CardHtml({ html, fallback }) {
  if (!html) return h(FactGrid, { facts: fallback });
  return h('div', { class: 'library-preview__card', dangerouslySetInnerHTML: { __html: html } });
}

function previewBody(ui, entry) {
  const data = entry.data || {};
  const withId = { ...data, id: entry.id };
  switch (entry.kind) {
    case LIBRARY_KIND.ITEM:
      return h(CardHtml, {
        html: renderItemCardSections(withId, previewSectionsFor(ui, 'item')),
        fallback: genericFacts(data),
      });
    case LIBRARY_KIND.SPELL:
      return h(CardHtml, {
        html: renderSpellPreviewSections(withId, previewSectionsFor(ui, 'spell')),
        fallback: genericFacts(data),
      });
    case LIBRARY_KIND.MAP: {
      const src = resolveMediaUrl(data.image_url, ui.widgetManager?.homeserver);
      return h('div', { class: 'library-preview__map' }, [
        src && h('img', { class: 'library-preview__thumb', src, alt: '', loading: 'lazy' }),
        h(FactGrid, { facts: mapFacts(data) }),
      ]);
    }
    case LIBRARY_KIND.RULESET:
      return h(FactGrid, { facts: rulesetFacts(data) });
    default:
      return h(FactGrid, { facts: genericFacts(data) });
  }
}

const KIND_LABELS = {
  [LIBRARY_KIND.CHARACTER]: 'Character',
  [LIBRARY_KIND.NPC]: 'NPC',
  [LIBRARY_KIND.ITEM]: 'Item',
  [LIBRARY_KIND.SPELL]: 'Spell',
  [LIBRARY_KIND.MAP]: 'Map',
  [LIBRARY_KIND.RULESET]: 'Ruleset',
};

function formatUpdated(ts) {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return null;
  }
}

export function LibraryPreview({ ui, entry, sourceLabel = null }) {
  const data = entry.data || {};
  const portrait = entry.kind !== LIBRARY_KIND.MAP
    ? resolveMediaUrl(data.image_url, ui.widgetManager?.homeserver)
    : null;
  const updated = formatUpdated(entry.updated_at);
  return h('div', { class: 'library-preview', 'data-library-preview': entry.id }, [
    h('div', { class: 'library-preview__head' }, [
      portrait && h('img', { class: 'library-preview__avatar', src: portrait, alt: '', loading: 'lazy' }),
      h('div', { class: 'library-preview__head-text' }, [
        h('div', { class: 'library-preview__name' }, entry.name),
        h('div', { class: 'library-preview__meta' }, [
          h('span', { class: 'library-preview__badge' }, KIND_LABELS[entry.kind] ?? entry.kind),
          sourceLabel && h('span', null, sourceLabel),
          updated && h('span', null, `Updated ${updated}`),
        ].filter(Boolean)),
      ]),
    ]),
    h('div', { class: 'library-preview__body' }, previewBody(ui, entry)),
    data.notes && h('div', { class: 'library-preview__notes' }, String(data.notes)),
  ]);
}
