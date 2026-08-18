/**
 * SRD compendium registry. Content files are large, so each system's
 * data loads through dynamic import: Vite splits them into chunks the
 * browser only fetches when the compendium UI is opened. Regenerate
 * the dnd5e data with scripts/build-5e-srd.mjs.
 */

const loaders = {
  dnd5e: async () => {
    const [spells, monsters, items] = await Promise.all([
      import('./dnd5e/spells.json', { with: { type: 'json' } }),
      import('./dnd5e/monsters.json', { with: { type: 'json' } }),
      import('./dnd5e/items.json', { with: { type: 'json' } }),
    ]);
    return {
      meta: spells.default.meta,
      spells: spells.default,
      monsters: monsters.default,
      items: items.default,
    };
  },
};

export function hasCompendium(systemSlug) {
  return Object.prototype.hasOwnProperty.call(loaders, systemSlug ?? '');
}

export async function loadCompendium(systemSlug) {
  if (!hasCompendium(systemSlug)) return null;
  return loaders[systemSlug]();
}
